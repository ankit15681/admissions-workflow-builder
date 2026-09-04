import type { ConditionTypeDefinition } from "./types";
import { getApplication } from "../../db/applications";

// "Has it been N days since <date field>?" — reads live state at the moment the
// branch is reached (C.1: "read reality, don't trust memory"), not at trigger time.
export const dateComparisonCondition: ConditionTypeDefinition = {
  type: "date_comparison",
  label: "Time since a date field",
  description: "True if at least N days/hours have passed since a date on the application.",
  configSchema: {
    type: "object",
    properties: {
      dateField: {
        type: "string",
        enum: ["created_at", "status_changed_at"],
        default: "status_changed_at",
      },
      comparator: { type: "string", enum: ["at_least"], default: "at_least" },
      amount: { type: "number", minimum: 0, default: 3 },
      unit: { type: "string", enum: ["minutes", "hours", "days"], default: "days" },
    },
    required: ["dateField", "amount", "unit"],
  },
  defaultConfig: { dateField: "status_changed_at", comparator: "at_least", amount: 3, unit: "days" },
  async evaluate(config, ctx) {
    const { dateField, amount = 0, unit } = config as { dateField: string; amount?: number; unit?: string };
    const app = getApplication(ctx.db, ctx.applicationId);
    if (!app) return false;
    const base = new Date(dateField === "created_at" ? app.created_at : app.status_changed_at).getTime();
    const now = new Date(ctx.now()).getTime();
    const msPerUnit = unit === "minutes" ? 60_000 : unit === "hours" ? 3_600_000 : 86_400_000;
    return now - base >= amount * msPerUnit;
  },
};
