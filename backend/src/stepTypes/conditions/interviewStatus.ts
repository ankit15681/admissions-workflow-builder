import type { ConditionTypeDefinition } from "./types";

// Reads back a Schedule Interview step's record so a Branch can route on whether the
// interview has happened — the same pattern as documentStatus / taskStatus.
export const interviewStatusCondition: ConditionTypeDefinition = {
  type: "interview_status",
  label: "Interview status",
  description: 'True if a Schedule Interview step\'s interview matches a status (e.g. "completed").',
  configSchema: {
    type: "object",
    properties: {
      interviewStepId: { type: "string", description: "The Schedule Interview step id to check." },
      status: { type: "string", enum: ["scheduled", "completed", "no_show"], default: "completed" },
    },
    required: ["interviewStepId", "status"],
  },
  defaultConfig: { interviewStepId: "", status: "completed" },
  async evaluate(config, ctx) {
    const { interviewStepId, status } = config as { interviewStepId: string; status: string };
    const row = ctx.db
      .prepare(`SELECT status FROM interviews WHERE run_id = ? AND step_id = ? ORDER BY scheduled_at DESC LIMIT 1`)
      .get(ctx.runId, interviewStepId) as { status: string } | undefined;
    return row?.status === status;
  },
};
