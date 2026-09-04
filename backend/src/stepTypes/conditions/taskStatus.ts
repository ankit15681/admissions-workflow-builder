import type { ConditionTypeDefinition } from "./types";

export const taskStatusCondition: ConditionTypeDefinition = {
  type: "task_status",
  label: "Task status",
  description: "True if an Assign to Staff / Create Task step's task is completed (optionally within its due date).",
  configSchema: {
    type: "object",
    properties: {
      taskStepId: { type: "string", description: "The Assign/Create Task step id to check." },
      status: { type: "string", enum: ["open", "completed"], default: "completed" },
      withinSla: {
        type: "boolean",
        default: false,
        description: "If true, also requires completed_at <= due_at.",
      },
    },
    required: ["taskStepId", "status"],
  },
  defaultConfig: { taskStepId: "", status: "completed", withinSla: false },
  async evaluate(config, ctx) {
    const { taskStepId, status, withinSla } = config as {
      taskStepId: string;
      status: string;
      withinSla?: boolean;
    };
    const row = ctx.db
      .prepare(`SELECT status, due_at, completed_at FROM tasks WHERE run_id = ? AND step_id = ? ORDER BY id DESC LIMIT 1`)
      .get(ctx.runId, taskStepId) as { status: string; due_at: string; completed_at: string | null } | undefined;
    if (!row) return false;
    if (row.status !== status) return false;
    if (status === "completed" && withinSla) {
      if (!row.completed_at) return false;
      return new Date(row.completed_at).getTime() <= new Date(row.due_at).getTime();
    }
    return true;
  },
};
