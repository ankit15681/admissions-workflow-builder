import type { StepTypeDefinition } from "./types";

export const goalStepType: StepTypeDefinition = {
  type: "goal",
  label: "Goal",
  icon: "target",
  color: "amber",
  category: "flow",
  description: "What counts as success.",
  summary: "{label}",
  summaryFallback: "Configure label",
  configSchema: {
    type: "object",
    properties: {
      label: { type: "string", minLength: 1, description: 'e.g. "Fee collected", "Escalated for manual follow-up"' },
    },
    required: ["label"],
  },
  defaultConfig: { label: "" },
  ports: { outputs: [] },
  async execute(config, _ctx) {
    const { label } = config as { label?: string };
    return { outcome: "end", label: label ?? "Unlabelled goal" };
  },
};
