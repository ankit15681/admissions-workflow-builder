import type { StepTypeDefinition } from "./types";

// The canvas encodes *where* this jumps to as an ordinary next[] edge (rendered dashed —
// see frontend lib/workflowConfigToGraph.ts), exactly like any other step. The only thing
// this step type owns is the hard iteration cap — enforced here independent of whatever
// Branches counter the flow author set up (spec item #8), as a safety net against runaway
// loops if a flow is authored without one.
export const goToActionStepType: StepTypeDefinition = {
  type: "go_to_action",
  label: "Go to action",
  icon: "corner-up-left",
  color: "emerald",
  category: "flow",
  description: "Jump to another step.",
  summary: "Loop cap: {maxIterations}",
  summaryFallback: "Set a loop cap",
  configSchema: {
    type: "object",
    properties: {
      maxIterations: {
        type: "number",
        minimum: 1,
        default: 10,
        description: "Hard platform cap on how many times this jump can be taken within one run.",
      },
    },
    required: ["maxIterations"],
  },
  defaultConfig: { maxIterations: 10 },
  ports: { outputs: [{ id: "next" }] },
  async execute(config, ctx) {
    const { maxIterations = 10 } = config as { maxIterations?: number };
    const cap = maxIterations;
    if (ctx.priorExecutionCount >= cap) {
      return {
        outcome: "end",
        runStatus: "escalated",
        label: "Escalation cap reached — needs manual follow-up",
        detail: `Hit the hard cap of ${cap} iterations on this loop; stopping automatically instead of looping forever.`,
      };
    }
    return { outcome: "advance" };
  },
};
