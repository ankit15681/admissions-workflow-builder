import type { StepTypeDefinition } from "./types";

// The Trigger is always steps[0] in a workflow. Its own `config` *is* the trigger
// config the Trigger Listener matches events against (see engine/triggerListener.ts) —
// there is no separate `trigger_config` column to keep in sync (see db/schema.sql).
export const triggerStepType: StepTypeDefinition = {
  type: "trigger",
  label: "Trigger",
  icon: "zap",
  color: "slate",
  category: "flow",
  description: "Starts the workflow.",
  configSchema: {
    type: "object",
    properties: {
      event: {
        type: "string",
        enum: ["form_started", "form_submitted", "status_changed"],
        default: "form_submitted",
        enumLabels: ["Application form started (not yet submitted)", "Application form submitted", "Application status changes to"],
        // Consumed by the frontend's "Choose a trigger" panel (shown on a brand-new,
        // unconfigured workflow) to group and icon the options generically, the same
        // way step type category/icon drive the "Choose an action" panel — never a
        // hardcoded per-event switch in the UI.
        enumGroups: ["Forms", "Forms", "Applications"],
        enumIcons: ["file-text", "clipboard-check", "flag"],
      },
      form: {
        type: "string",
        enum: ["any", "enquiry", "application", "enrolment", "scholarship"],
        default: "any",
        enumLabels: ["Any Application form", "Enquiry form", "Application form", "Enrolment form", "Scholarship form"],
        description: "Only used when event = form_started or form_submitted — which form this trigger listens to.",
      },
      targetStatus: {
        type: "string",
        description: "Only used when event = status_changed — the status value that fires this trigger.",
      },
    },
    required: ["event"],
  },
  defaultConfig: { event: "form_submitted" },
  ports: { outputs: [{ id: "next" }] },
  async execute(_config, _ctx) {
    // The trigger step never actually "runs" mid-flow — the Trigger Listener creates
    // the run already positioned past it. execute() exists so the executor's uniform
    // step-walking loop doesn't need a special case for step index 0.
    return { outcome: "advance" };
  },
};
