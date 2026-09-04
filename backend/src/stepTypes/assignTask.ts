import type { StepTypeDefinition } from "./types";

const MS_PER_DAY = 86_400_000;

export const assignTaskStepType: StepTypeDefinition = {
  type: "assign_task",
  label: "Assign to Staff / Create Task",
  icon: "clipboard-check",
  color: "violet",
  category: "staff",
  description: "Assign the application to a person and track a task.",
  summary: "Assign to {assignee}",
  summaryFallback: "Configure assignee",
  configSchema: {
    type: "object",
    properties: {
      assignee: { type: "string", minLength: 1, description: 'A person or role, e.g. "Admissions Head"' },
      title: { type: "string", minLength: 1 },
      dueInDays: { type: "number", minimum: 0, default: 5 },
    },
    required: ["assignee", "title", "dueInDays"],
  },
  defaultConfig: { assignee: "", title: "", dueInDays: 5 },
  ports: { outputs: [{ id: "next" }] },
  async execute(config, ctx) {
    const { assignee, title, dueInDays = 5 } = config as { assignee: string; title: string; dueInDays?: number };
    const dueAt = new Date(new Date(ctx.now()).getTime() + dueInDays * MS_PER_DAY).toISOString();
    ctx.db
      .prepare(
        `INSERT INTO tasks (run_id, step_id, assignee, title, due_at, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'open', ?)`
      )
      .run(ctx.runId, ctx.stepId, assignee, title, dueAt, ctx.now());
    ctx.db
      .prepare(`UPDATE applications SET assigned_reviewer = ? WHERE id = ?`)
      .run(assignee, ctx.applicationId);
    return { outcome: "advance", detail: `Assigned to ${assignee}, due ${dueAt}` };
  },
};
