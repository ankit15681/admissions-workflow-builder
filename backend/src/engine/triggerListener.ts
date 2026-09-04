import type { Database } from "better-sqlite3";
import { nanoid } from "nanoid";
import { getWorkflowRow, type Step } from "../db/workflows";
import { advanceRun } from "./executor";

export type ApplicationEvent =
  | { type: "form_submitted"; applicationId: string; form?: string }
  | { type: "form_started"; applicationId: string; form?: string }
  | { type: "status_changed"; applicationId: string; newStatus: string };

function nowIso(): string {
  return new Date().toISOString();
}

function triggerMatches(triggerStep: Step, event: ApplicationEvent): boolean {
  const cfg = triggerStep.config ?? {};
  if (cfg.event !== event.type) return false;
  if (event.type === "status_changed") {
    return !cfg.targetStatus || cfg.targetStatus === event.newStatus;
  }
  // form_submitted / form_started: an unset trigger form (or "any") matches every
  // submission; a specific one only matches that same form. An event fired with no
  // form specified is treated as "any" too, so triggers saved before this field
  // existed — and demo events that don't pass one — keep matching everything.
  const triggerForm = cfg.form && cfg.form !== "any" ? cfg.form : null;
  const eventForm = event.form && event.form !== "any" ? event.form : null;
  return !triggerForm || triggerForm === eventForm;
}

/**
 * Turns an admissions-system event into new, independent WorkflowRuns (FR-3): every
 * *published* workflow whose Trigger step (always steps[0]) matches gets its own run,
 * each carrying its own steps_snapshot so a later edit can't affect it (FR-11).
 */
export async function dispatchApplicationEvent(db: Database, event: ApplicationEvent): Promise<string[]> {
  const workflows = db.prepare(`SELECT id FROM workflows WHERE status = 'published'`).all() as { id: string }[];
  const startedRunIds: string[] = [];

  for (const { id } of workflows) {
    const row = getWorkflowRow(db, id);
    if (!row?.published_steps) continue;
    const steps: Step[] = JSON.parse(row.published_steps);
    const trigger = steps[0];
    if (!trigger || trigger.type !== "trigger") continue;
    if (!triggerMatches(trigger, event)) continue;

    const runId = nanoid();
    const now = nowIso();
    const firstRealStepId = trigger.next[0]?.targetId ?? trigger.id;
    db.prepare(
      `INSERT INTO workflow_runs (id, workflow_id, application_id, current_step_id, status, steps_snapshot, started_at, updated_at)
       VALUES (?, ?, ?, ?, 'running', ?, ?, ?)`
    ).run(runId, id, event.applicationId, firstRealStepId, JSON.stringify(steps), now, now);

    startedRunIds.push(runId);
    await advanceRun(db, runId);
  }

  return startedRunIds;
}
