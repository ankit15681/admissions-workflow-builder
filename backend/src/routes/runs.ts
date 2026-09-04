import { Router } from "express";
import { db } from "../db";

export const runsRouter = Router();

// Run history (FR-10, NFR-4) — "what happened to this applicant's reminders" without
// reading raw logs. Polled by the frontend (REST only, no WebSockets — spec item #7).
runsRouter.get("/workflows/:id/runs", (req, res) => {
  const runs = db
    .prepare(
      `SELECT r.*, a.applicant_name, a.programme
       FROM workflow_runs r JOIN applications a ON a.id = r.application_id
       WHERE r.workflow_id = ? ORDER BY r.started_at DESC`
    )
    .all(req.params.id);
  res.json(runs);
});

runsRouter.get("/runs/:id/history", (req, res) => {
  const run = db.prepare(`SELECT * FROM workflow_runs WHERE id = ?`).get(req.params.id);
  if (!run) return res.status(404).json({ error: "Not found" });
  const history = db
    .prepare(`SELECT * FROM run_step_history WHERE run_id = ? ORDER BY id ASC`)
    .all(req.params.id);
  const documentRequests = db.prepare(`SELECT * FROM document_requests WHERE run_id = ?`).all(req.params.id);
  const tasks = db.prepare(`SELECT * FROM tasks WHERE run_id = ?`).all(req.params.id);
  res.json({ run, history, documentRequests, tasks });
});
