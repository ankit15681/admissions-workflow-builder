import type { StepTypeDefinition } from "./types";

const MS_PER_UNIT: Record<string, number> = {
  seconds: 1_000,
  minutes: 60_000,
  hours: 3_600_000,
  days: 86_400_000,
};

export const delayStepType: StepTypeDefinition = {
  type: "delay",
  label: "Delay",
  icon: "clock",
  color: "orange",
  category: "flow",
  description: "Wait.",
  summary: "Wait {amount} {unit}",
  summaryFallback: "Configure delay",
  configSchema: {
    type: "object",
    properties: {
      amount: { type: "number", minimum: 0, default: 3 },
      unit: { type: "string", enum: ["seconds", "minutes", "hours", "days"], default: "days" },
    },
    required: ["amount", "unit"],
  },
  defaultConfig: { amount: 3, unit: "days" },
  ports: { outputs: [{ id: "next" }] },
  async execute(config, ctx) {
    const { amount = 0, unit = "days" } = config as { amount?: number; unit?: string };
    const ms = amount * (MS_PER_UNIT[unit] ?? MS_PER_UNIT.days);
    const resumeAt = new Date(new Date(ctx.now()).getTime() + ms).toISOString();
    return { outcome: "wait", resumeAt, detail: `Waiting ${amount} ${unit}` };
  },
};
