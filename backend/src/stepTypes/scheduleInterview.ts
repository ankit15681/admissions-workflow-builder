import type { StepTypeDefinition } from "./types";
import { nanoid } from "nanoid";

// Books an interview for the applicant. Like Request Document and Assign Task, it creates
// its side-effect record (a row in `interviews`) the moment the step runs; a Branch using
// the `interview_status` condition can then route on whether the interview has happened.
export const scheduleInterviewStepType: StepTypeDefinition = {
  type: "schedule_interview",
  label: "Schedule Interview",
  icon: "calendar",
  color: "rose",
  category: "scheduling",
  description: "Book an interview slot for the applicant.",
  summary: "Interview — {mode}",
  summaryFallback: "Configure interview",
  configSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["in_person", "video"],
        enumLabels: ["In person", "Video call"],
        default: "video",
      },
      room: { type: "string", description: "Room / location (in-person interviews only)." },
      durationMins: { type: "number", minimum: 15, default: 30 },
    },
    required: ["mode", "durationMins"],
  },
  defaultConfig: { mode: "video", room: "", durationMins: 30 },
  ports: { outputs: [{ id: "next" }] },
  async execute(config, ctx) {
    const { mode = "video", room = "", durationMins = 30 } = config as {
      mode?: string;
      room?: string;
      durationMins?: number;
    };
    // Idempotent by the same one-row-per-(run,step) shape as Request Document: if this
    // step already scheduled an interview in this run, don't create a duplicate.
    const existing = ctx.db
      .prepare(`SELECT id FROM interviews WHERE run_id = ? AND step_id = ?`)
      .get(ctx.runId, ctx.stepId);
    if (!existing) {
      ctx.db
        .prepare(
          `INSERT INTO interviews (id, run_id, step_id, application_id, mode, room, duration_mins, status, scheduled_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled', ?)`
        )
        .run(nanoid(), ctx.runId, ctx.stepId, ctx.applicationId, mode, room, durationMins, ctx.now());
    }
    return { outcome: "advance", detail: `Interview scheduled (${mode}, ${durationMins}m)` };
  },
};
