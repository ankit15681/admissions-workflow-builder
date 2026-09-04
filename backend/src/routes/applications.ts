import { Router } from "express";
import { db } from "../db";
import { listApplications, setApplicationField } from "../db/applications";
import { dispatchApplicationEvent } from "../engine/triggerListener";

export const applicationsRouter = Router();

function nowIso(): string {
  return new Date().toISOString();
}

// A stand-in for "the admissions system" this exercise assumes already exists (A.6) —
// enough to demo triggers firing and Branches reading real state, not a real SIS.
applicationsRouter.get("/applications", (_req, res) => {
  res.json(listApplications(db));
});

applicationsRouter.post("/applications/:id/submit", async (req, res) => {
  const { form } = req.body ?? {};
  const runIds = await dispatchApplicationEvent(db, { type: "form_submitted", applicationId: req.params.id, form });
  res.json({ startedRunIds: runIds });
});

applicationsRouter.post("/applications/:id/start", async (req, res) => {
  const { form } = req.body ?? {};
  const runIds = await dispatchApplicationEvent(db, { type: "form_started", applicationId: req.params.id, form });
  res.json({ startedRunIds: runIds });
});

// Sets application.status and fires the status_changed event that Trigger steps
// listen for — mirrors how a real SIS webhook/poll would feed the Trigger Listener.
applicationsRouter.post("/applications/:id/status", async (req, res) => {
  const { status } = req.body ?? {};
  if (!status) return res.status(400).json({ error: "status is required" });
  setApplicationField(db, req.params.id, "status", status, nowIso());
  const runIds = await dispatchApplicationEvent(db, { type: "status_changed", applicationId: req.params.id, newStatus: status });
  res.json({ startedRunIds: runIds });
});

applicationsRouter.post("/applications/:id/fee-status", (req, res) => {
  const { feeStatus } = req.body ?? {};
  if (!feeStatus) return res.status(400).json({ error: "feeStatus is required" });
  setApplicationField(db, req.params.id, "fee_status", feeStatus, nowIso());
  res.json({ ok: true });
});

// Demo-only affordances so Branches conditions reading DocumentRequest/Task status
// (C.4) have something real to flip — simulating the applicant/staff side of those
// steps, which live outside the builder itself.
applicationsRouter.post("/document-requests/:id/submit", (req, res) => {
  const row = db.prepare(`SELECT * FROM document_requests WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  db.prepare(`UPDATE document_requests SET status = 'submitted', submitted_at = ? WHERE id = ?`).run(nowIso(), req.params.id);
  res.json({ ok: true });
});

applicationsRouter.post("/tasks/:id/complete", (req, res) => {
  const row = db.prepare(`SELECT * FROM tasks WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  db.prepare(`UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ?`).run(nowIso(), req.params.id);
  res.json({ ok: true });
});

applicationsRouter.post("/interviews/:id/complete", (req, res) => {
  const row = db.prepare(`SELECT * FROM interviews WHERE id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  db.prepare(`UPDATE interviews SET status = 'completed', completed_at = ? WHERE id = ?`).run(nowIso(), req.params.id);
  res.json({ ok: true });
});
