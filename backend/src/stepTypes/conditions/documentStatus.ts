import type { ConditionTypeDefinition } from "./types";

export const documentStatusCondition: ConditionTypeDefinition = {
  type: "document_status",
  label: "Document request status",
  description: "True if a Request Document step's upload status matches (e.g. \"submitted\").",
  configSchema: {
    type: "object",
    properties: {
      requestStepId: { type: "string", description: "The Request Document step id to check." },
      status: { type: "string", enum: ["pending", "submitted"], default: "submitted" },
    },
    required: ["requestStepId", "status"],
  },
  defaultConfig: { requestStepId: "", status: "submitted" },
  async evaluate(config, ctx) {
    const { requestStepId, status } = config as { requestStepId: string; status: string };
    const row = ctx.db
      .prepare(`SELECT status FROM document_requests WHERE run_id = ? AND step_id = ? ORDER BY requested_at DESC LIMIT 1`)
      .get(ctx.runId, requestStepId) as { status: string } | undefined;
    return row?.status === status;
  },
};
