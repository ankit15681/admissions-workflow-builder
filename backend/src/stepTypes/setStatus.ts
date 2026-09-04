import type { StepTypeDefinition } from "./types";
import { setApplicationField } from "../db/applications";

export const setStatusStepType: StepTypeDefinition = {
  type: "set_status",
  label: "Set status",
  icon: "check-square",
  color: "teal",
  category: "application",
  description: "Change the application's status.",
  summary: "{field} = {value}",
  summaryFallback: "Configure status",
  configSchema: {
    type: "object",
    properties: {
      field: { type: "string", enum: ["status", "fee_status"], default: "status" },
      value: { type: "string", minLength: 1 },
    },
    required: ["field", "value"],
  },
  defaultConfig: { field: "status", value: "" },
  ports: { outputs: [{ id: "next" }] },
  async execute(config, ctx) {
    const { field, value } = config as { field: "status" | "fee_status"; value: string };
    setApplicationField(ctx.db, ctx.applicationId, field, value, ctx.now());
    return { outcome: "advance", detail: `${field} = ${value}` };
  },
};
