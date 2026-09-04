import type { ConditionTypeDefinition } from "./types";
import { getApplication } from "../../db/applications";

export const statusEqualsCondition: ConditionTypeDefinition = {
  type: "status_equals",
  label: "Application status equals",
  description: "True if the application's current status matches a value (e.g. \"Fee Paid\").",
  configSchema: {
    type: "object",
    properties: {
      field: { type: "string", enum: ["status", "fee_status"], default: "status" },
      value: { type: "string" },
    },
    required: ["field", "value"],
  },
  defaultConfig: { field: "status", value: "" },
  async evaluate(config, ctx) {
    const { field, value } = config as { field: string; value: string };
    const app = getApplication(ctx.db, ctx.applicationId);
    if (!app) return false;
    const current = field === "fee_status" ? app.fee_status : app.status;
    return current === value;
  },
};
