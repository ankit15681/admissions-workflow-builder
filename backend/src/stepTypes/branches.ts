import type { StepTypeDefinition } from "./types";
import { conditionTypeRegistry } from "./conditions/registry";

export const branchesStepType: StepTypeDefinition = {
  type: "branches",
  label: "Branches",
  icon: "split",
  color: "indigo",
  category: "flow",
  description: "Split the path.",
  configSchema: {
    type: "object",
    properties: {
      conditionType: {
        type: "string",
        enum: Object.keys(conditionTypeRegistry),
        description: "Which condition sub-type to evaluate — see GET /api/condition-types.",
      },
      conditionConfig: {
        type: "object",
        description: "Shape depends on conditionType; validated against that condition's own configSchema.",
      },
    },
    required: ["conditionType", "conditionConfig"],
  },
  defaultConfig: { conditionType: "status_equals", conditionConfig: { field: "status", value: "" } },
  ports: { outputs: [{ id: "yes", label: "Yes" }, { id: "no", label: "No" }] },
  async execute(config, ctx) {
    const { conditionType, conditionConfig } = config as {
      conditionType: string;
      conditionConfig?: Record<string, unknown>;
    };
    const condition = conditionTypeRegistry[conditionType];
    if (!condition) {
      return { outcome: "error", detail: `Unknown condition type "${conditionType}"` };
    }
    const result = await condition.evaluate(conditionConfig ?? {}, {
      applicationId: ctx.applicationId,
      runId: ctx.runId,
      stepId: ctx.stepId,
      db: ctx.db,
      now: ctx.now,
    });
    return { outcome: "advance", toPort: result ? "yes" : "no", detail: `${conditionType} => ${result}` };
  },
};
