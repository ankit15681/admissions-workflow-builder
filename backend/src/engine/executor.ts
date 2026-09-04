import type { Database } from "better-sqlite3";
import { stepTypeRegistry } from "../stepTypes/registry";
import type { Step } from "../db/workflows";

function nowIso(): string {
  return new Date().toISOString();
}

function findStep(steps: Step[], id: string | null): Step | undefined {
  if (!id) return undefined;
  return steps.find((s) => s.id === id);
}

function nextStepId(step: Step, portId: string): string | undefined {
  // A linear step has one "next" edge; Branches has "yes"/"no". If a step only has
  // one outgoing edge, use it regardless of the requested port (defensive default).
  const exact = step.next.find((n) => n.portId === portId);
  if (exact) return exact.targetId;
  if (step.next.length === 1) return step.next[0].targetId;
  return undefined;
}

interface RunRow {
  id: string;
  workflow_id: string;
  application_id: string;
  current_step_id: string | null;
  status: string;
  goal_label: string | null;
  steps_snapshot: string;
  due_at: string | null;
  started_at: string;
  ended_at: string | null;
  updated_at: string;
}

function getRun(db: Database, runId: string): RunRow | undefined {
  return db.prepare(`SELECT * FROM workflow_runs WHERE id = ?`).get(runId) as RunRow | undefined;
}

function historyCountForStep(db: Database, runId: string, stepId: string): number {
  const row = db
    .prepare(`SELECT COUNT(*) as n FROM run_step_history WHERE run_id = ? AND step_id = ?`)
    .get(runId, stepId) as { n: number };
  return row?.n ?? 0;
}

/**
 * Walks a run forward from its current step, synchronously (single Node process,
 * no concurrent workers for this exercise) until it hits a Delay (wait), a Goal
 * (end), an error, or runs off the end of the graph.
 *
 * Idempotency (NFR-2): a "pending" RunStepHistory row is reserved for (run, step,
 * attempt) *before* execute() runs its side effect. The unique index on
 * (run_id, step_id, attempt) means a resume that races with an already-reserved
 * attempt fails the insert and is skipped rather than double-executing.
 */
export async function advanceRun(db: Database, runId: string): Promise<void> {
  let guard = 0;
  while (guard++ < 500) {
    const run = getRun(db, runId);
    if (!run || run.status !== "running") return;

    const steps: Step[] = JSON.parse(run.steps_snapshot);
    const step = findStep(steps, run.current_step_id);
    if (!step) {
      finishRun(db, runId, "error", null, "Run pointed at a step no longer in its snapshot.");
      return;
    }

    const def = stepTypeRegistry[step.type];
    if (!def) {
      finishRun(db, runId, "error", null, `Unknown step type "${step.type}"`);
      return;
    }

    const attempt = historyCountForStep(db, runId, step.id) + 1;
    const priorExecutionCount = attempt - 1;
    const executedAt = nowIso();

    try {
      db.prepare(
        `INSERT INTO run_step_history (run_id, step_id, step_type, attempt, executed_at, result, detail)
         VALUES (?, ?, ?, ?, ?, 'pending', NULL)`
      ).run(runId, step.id, step.type, attempt, executedAt);
    } catch {
      // Another in-flight call already reserved this attempt — don't double-execute.
      return;
    }

    let result;
    try {
      result = await def.execute(step.config ?? {}, {
        runId,
        workflowId: run.workflow_id,
        applicationId: run.application_id,
        stepId: step.id,
        priorExecutionCount,
        db,
        now: nowIso,
      });
    } catch (err: unknown) {
      result = { outcome: "error" as const, detail: err instanceof Error ? err.message : String(err) };
    }

    db.prepare(`UPDATE run_step_history SET result = ?, detail = ? WHERE run_id = ? AND step_id = ? AND attempt = ?`).run(
      result.outcome,
      "detail" in result ? result.detail ?? null : null,
      runId,
      step.id,
      attempt
    );

    if (result.outcome === "error") {
      finishRun(db, runId, "error", null, result.detail);
      return;
    }

    if (result.outcome === "end") {
      finishRun(db, runId, result.runStatus ?? "completed", result.label, result.detail ?? null);
      return;
    }

    if (result.outcome === "wait") {
      // Advance current_step_id past the Delay itself *before* going to sleep. When the
      // scheduler resumes this run it just flips status back to 'running' and calls
      // advanceRun — if current_step_id still pointed at the Delay step, resuming would
      // re-execute the Delay (and re-schedule another wait) forever instead of moving on.
      const targetId = nextStepId(step, "next");
      if (!targetId) {
        finishRun(db, runId, "completed", "Ended (no Goal step reached)", null);
        return;
      }
      db.prepare(
        `UPDATE workflow_runs SET status = 'waiting', current_step_id = ?, due_at = ?, updated_at = ? WHERE id = ?`
      ).run(targetId, result.resumeAt, nowIso(), runId);
      return;
    }

    // advance
    const targetId = nextStepId(step, result.toPort ?? "next");
    if (!targetId) {
      // Ran off the end of the graph with no Goal step — treat as a clean, unlabelled stop.
      finishRun(db, runId, "completed", "Ended (no Goal step reached)", null);
      return;
    }
    db.prepare(`UPDATE workflow_runs SET current_step_id = ?, updated_at = ? WHERE id = ?`).run(
      targetId,
      nowIso(),
      runId
    );
    // loop continues to execute the next step immediately (steps other than Delay run
    // straight through — see design doc C.5)
  }
}

function finishRun(db: Database, runId: string, status: "completed" | "error" | "escalated", goalLabel: string | null, _detail: string | null) {
  db.prepare(
    `UPDATE workflow_runs SET status = ?, goal_label = ?, ended_at = ?, updated_at = ? WHERE id = ?`
  ).run(status, goalLabel, nowIso(), nowIso(), runId);
}

/** Resume every run whose Delay has come due. Called by the scheduler on each tick. */
export async function resumeDueRuns(db: Database): Promise<number> {
  const due = db
    .prepare(`SELECT id FROM workflow_runs WHERE status = 'waiting' AND due_at <= ?`)
    .all(nowIso()) as { id: string }[];
  for (const { id } of due) {
    db.prepare(`UPDATE workflow_runs SET status = 'running', updated_at = ? WHERE id = ?`).run(nowIso(), id);
    await advanceRun(db, id);
  }
  return due.length;
}
