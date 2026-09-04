import type { StepTypeDefinition } from "./types";
import { nanoid } from "nanoid";

export const requestDocumentStepType: StepTypeDefinition = {
  type: "request_document",
  label: "Request Document",
  icon: "file-text",
  color: "sky",
  category: "application",
  description: "Ask for and track an upload.",
  summary: "Request: {requestedFiles}",
  summaryFallback: "Configure checklist",
  configSchema: {
    type: "object",
    properties: {
      recipient: { type: "string", enum: ["applicant", "guardian"], default: "guardian" },
      requestedFiles: {
        type: "array",
        items: { type: "string" },
        minItems: 1,
        default: ["ID proof", "Previous school records"],
        description: 'Checklist, e.g. ["ID proof", "Previous school records", "Immunisation record"]',
      },
      dueInDays: { type: "number", minimum: 0, default: 7 },
    },
    required: ["recipient", "requestedFiles"],
  },
  defaultConfig: { recipient: "guardian", requestedFiles: [], dueInDays: 7 },
  ports: { outputs: [{ id: "next" }] },
  async execute(config, ctx) {
    const { requestedFiles = [] } = config as { requestedFiles?: string[] };
    // Creates the record the moment the step runs (C.3); a reminder loop afterwards
    // is just an ordinary Communicate + Delay + Branches(document_status), not
    // reinvented here.
    const existing = ctx.db
      .prepare(`SELECT id FROM document_requests WHERE run_id = ? AND step_id = ?`)
      .get(ctx.runId, ctx.stepId);
    if (!existing) {
      ctx.db
        .prepare(
          `INSERT INTO document_requests (id, run_id, step_id, requested_files, uploaded_files, status, requested_at)
           VALUES (?, ?, ?, ?, '[]', 'pending', ?)`
        )
        .run(nanoid(), ctx.runId, ctx.stepId, JSON.stringify(requestedFiles), ctx.now());
    }
    return { outcome: "advance", detail: `Requested: ${requestedFiles.join(", ")}` };
  },
};
