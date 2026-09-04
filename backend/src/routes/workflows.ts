import { Router } from "express";
import { nanoid } from "nanoid";
import { db } from "../db";
import {
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  listWorkflows,
  publishWorkflow,
  saveDraft,
  unpublishWorkflow,
  updateWorkflowName,
  type Step,
} from "../db/workflows";

export const workflowsRouter = Router();

function nowIso(): string {
  return new Date().toISOString();
}

workflowsRouter.get("/workflows", (_req, res) => {
  res.json(listWorkflows(db));
});

// A new workflow starts with an empty steps[] — no trigger yet — matching the demo's
// "Untitled workflow" starting point: the builder shows a dashed Trigger/Action preview
// and opens "Choose a trigger" automatically (frontend/src/pages/WorkflowBuilderPage.tsx),
// rather than pre-picking a default event on the caller's behalf.
workflowsRouter.post("/workflows", (req, res) => {
  const { name, description } = req.body ?? {};
  const wf = createWorkflow(
    db,
    { id: nanoid(), name: typeof name === "string" && name.trim() ? name : "Untitled workflow", description: description ?? "", steps: [] },
    nowIso()
  );
  res.status(201).json(wf);
});

workflowsRouter.get("/workflows/:id", (req, res) => {
  const wf = getWorkflow(db, req.params.id);
  if (!wf) return res.status(404).json({ error: "Not found" });
  res.json(wf);
});

// Renames a workflow — separate from the draft autosave (C.6.4's draft_revision guard
// is about steps[], not metadata like the name, so this doesn't touch draft_revision).
workflowsRouter.patch("/workflows/:id", (req, res) => {
  const { name } = req.body ?? {};
  if (typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  const existing = getWorkflow(db, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  res.json(updateWorkflowName(db, req.params.id, name.trim(), nowIso()));
});

// Deletes a workflow (and, per db/workflows.ts's deleteWorkflow, any runs/history/tasks it
// owns). Irreversible — the frontend gates this behind a confirmation modal rather than
// firing it straight off a click, same as any other destructive action in the app.
workflowsRouter.delete("/workflows/:id", (req, res) => {
  const existing = getWorkflow(db, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  deleteWorkflow(db, req.params.id);
  res.status(204).end();
});

// Debounced autosave target (C.6.4). Sends the whole draft snapshot, not a per-step
// diff — these workflows run to a few dozen steps, so the added complexity of granular
// patches isn't worth it here (see design doc, same section).
workflowsRouter.patch("/workflows/:id/draft", (req, res) => {
  const { steps, expectedRevision } = req.body ?? {};
  if (!Array.isArray(steps) || typeof expectedRevision !== "number") {
    return res.status(400).json({ error: "steps[] and expectedRevision are required" });
  }
  const existing = getWorkflow(db, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });

  const saved = saveDraft(db, req.params.id, steps as Step[], expectedRevision, nowIso());
  if (!saved) {
    // Stale write — someone else's save (or another tab) landed first. Return the
    // current server state so the client can reconcile instead of silently overwriting it.
    return res.status(409).json({ error: "Draft revision conflict", current: getWorkflow(db, req.params.id) });
  }
  res.json(saved);
});

// Separate, explicit, non-debounced action (C.6.4). Overwrites the single published
// copy — safe by construction because in-flight runs already captured their own
// steps_snapshot, not a live pointer to the workflow.
workflowsRouter.post("/workflows/:id/publish", (req, res) => {
  const existing = getWorkflow(db, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  res.json(publishWorkflow(db, req.params.id, nowIso()));
});

// Takes a published workflow back to draft. Its published_steps/published_revision are left
// alone (see unpublishWorkflow) — the meaningful effect is the status flip, since the
// Trigger Listener only matches events against workflows with status = 'published'.
workflowsRouter.post("/workflows/:id/unpublish", (req, res) => {
  const existing = getWorkflow(db, req.params.id);
  if (!existing) return res.status(404).json({ error: "Not found" });
  res.json(unpublishWorkflow(db, req.params.id, nowIso()));
});
