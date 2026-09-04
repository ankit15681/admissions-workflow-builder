import type { ConditionTypeDefinition } from "./types";

// A run-scoped counter — "has this step run fewer than N times in this run?" —
// backs every bounded reminder loop in the design doc (FR-5, Part B). It reads
// ctx via RunStepHistory count, injected by the executor as priorExecutionCount
// on the *target* step being counted, so the condition itself stays a pure
// comparison with no DB access of its own.
export const counterCondition: ConditionTypeDefinition = {
  type: "run_counter",
  label: "Run-scoped counter",
  description: "True if a named counter step has executed fewer than N times so far in this run.",
  configSchema: {
    type: "object",
    properties: {
      counterStepId: { type: "string", description: "The step id whose execution count to read." },
      comparator: { type: "string", enum: ["less_than", "at_least"], default: "less_than" },
      limit: { type: "number", minimum: 0, default: 3 },
    },
    required: ["counterStepId", "comparator", "limit"],
  },
  defaultConfig: { counterStepId: "", comparator: "less_than", limit: 3 },
  async evaluate(config, ctx) {
    const { counterStepId, comparator, limit = 0 } = config as {
      counterStepId: string;
      comparator: string;
      limit?: number;
    };
    const row = ctx.db
      .prepare(`SELECT COUNT(*) as n FROM run_step_history WHERE run_id = ? AND step_id = ?`)
      .get(ctx.runId, counterStepId) as { n: number };
    const n = row?.n ?? 0;
    return comparator === "less_than" ? n < limit : n >= limit;
  },
};
