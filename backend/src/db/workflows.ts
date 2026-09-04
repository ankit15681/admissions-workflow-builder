import type { Database } from "better-sqlite3";

export interface StepNext {
  portId: string;
  targetId: string;
}

export interface Step {
  id: string;
  type: string;
  config: Record<string, unknown>;
  next: StepNext[];
  // No stored `position` — a workflow is a pure DAG; the builder derives canvas positions
  // from the graph shape on render (frontend lib/layoutGraph.ts). The executor never needed
  // positions anyway, so nothing server-side is affected.
}

export interface WorkflowRow {
  id: string;
  name: string;
  description: string;
  status: "draft" | "published";
  draft_revision: number;
  draft_steps: string; // JSON
  published_steps: string | null; // JSON
  published_revision: number | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowDTO {
  id: string;
  name: string;
  description: string;
  status: "draft" | "published";
  draftRevision: number;
  draftSteps: Step[];
  publishedSteps: Step[] | null;
  publishedRevision: number | null;
  createdAt: string;
  updatedAt: string;
}

export function toDTO(row: WorkflowRow): WorkflowDTO {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    draftRevision: row.draft_revision,
    draftSteps: JSON.parse(row.draft_steps),
    publishedSteps: row.published_steps ? JSON.parse(row.published_steps) : null,
    publishedRevision: row.published_revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listWorkflows(db: Database): WorkflowDTO[] {
  const rows = db.prepare(`SELECT * FROM workflows ORDER BY updated_at DESC`).all() as WorkflowRow[];
  return rows.map(toDTO);
}

export function getWorkflow(db: Database, id: string): WorkflowDTO | undefined {
  const row = db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(id) as WorkflowRow | undefined;
  return row ? toDTO(row) : undefined;
}

export function getWorkflowRow(db: Database, id: string): WorkflowRow | undefined {
  return db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(id) as WorkflowRow | undefined;
}

export function createWorkflow(
  db: Database,
  params: { id: string; name: string; description: string; steps: Step[] },
  now: string
): WorkflowDTO {
  db.prepare(
    `INSERT INTO workflows (id, name, description, status, draft_revision, draft_steps, published_steps, published_revision, created_at, updated_at)
     VALUES (?, ?, ?, 'draft', 0, ?, NULL, NULL, ?, ?)`
  ).run(params.id, params.name, params.description, JSON.stringify(params.steps), now, now);
  return getWorkflow(db, params.id)!;
}

/** Returns null on a stale-write conflict (expectedRevision doesn't match). */
export function saveDraft(
  db: Database,
  id: string,
  steps: Step[],
  expectedRevision: number,
  now: string
): WorkflowDTO | null {
  const row = getWorkflowRow(db, id);
  if (!row) throw new Error("Workflow not found");
  if (row.draft_revision !== expectedRevision) return null;
  db.prepare(
    `UPDATE workflows SET draft_steps = ?, draft_revision = draft_revision + 1, updated_at = ? WHERE id = ?`
  ).run(JSON.stringify(steps), now, id);
  return getWorkflow(db, id)!;
}

export function updateWorkflowName(db: Database, id: string, name: string, now: string): WorkflowDTO {
  const row = getWorkflowRow(db, id);
  if (!row) throw new Error("Workflow not found");
  db.prepare(`UPDATE workflows SET name = ?, updated_at = ? WHERE id = ?`).run(name, now, id);
  return getWorkflow(db, id)!;
}

// Deleting a workflow cascades to its runs and everything a run owns (history, document
// requests, tasks) — `foreign_keys = ON` (see db/index.ts) means a plain DELETE on
// `workflows` would otherwise fail with a constraint error the moment any run exists.
// Wrapped in a transaction so a workflow with runs is deleted atomically or not at all.
export function deleteWorkflow(db: Database, id: string): void {
  const runIds = (db.prepare(`SELECT id FROM workflow_runs WHERE workflow_id = ?`).all(id) as { id: string }[]).map(
    (r) => r.id
  );

  const tx = db.transaction(() => {
    for (const runId of runIds) {
      db.prepare(`DELETE FROM tasks WHERE run_id = ?`).run(runId);
      db.prepare(`DELETE FROM document_requests WHERE run_id = ?`).run(runId);
      db.prepare(`DELETE FROM run_step_history WHERE run_id = ?`).run(runId);
    }
    db.prepare(`DELETE FROM workflow_runs WHERE workflow_id = ?`).run(id);
    db.prepare(`DELETE FROM workflows WHERE id = ?`).run(id);
  });
  tx();
}

export function publishWorkflow(db: Database, id: string, now: string): WorkflowDTO {
  const row = getWorkflowRow(db, id);
  if (!row) throw new Error("Workflow not found");
  db.prepare(
    `UPDATE workflows SET status = 'published', published_steps = draft_steps, published_revision = draft_revision, updated_at = ? WHERE id = ?`
  ).run(now, id);
  return getWorkflow(db, id)!;
}

// Flips status back to 'draft' without touching published_steps/published_revision — they
// stay in place as "what was last live" rather than being wiped, so a later re-publish isn't
// the only way to see it again. The Trigger Listener only fires runs for status = 'published'
// (see engine/triggerListener.ts), so this is the whole mechanism that actually stops a live
// workflow from running — no separate "enabled" flag to keep in sync.
export function unpublishWorkflow(db: Database, id: string, now: string): WorkflowDTO {
  const row = getWorkflowRow(db, id);
  if (!row) throw new Error("Workflow not found");
  db.prepare(`UPDATE workflows SET status = 'draft', updated_at = ? WHERE id = ?`).run(now, id);
  return getWorkflow(db, id)!;
}
