import type { ComponentType } from "react";
import { Branches } from "./Branches";
import { Communicate } from "./Communicate";
import { Trigger } from "./Trigger";
import { GoToAction } from "./GoToAction";
import { ScheduleInterview } from "./ScheduleInterview";

export interface StepEditorProps {
  // The step being edited — only GoToAction currently needs it (to exclude itself from its
  // own "Jump to" options), but every step editor receives it so a future one that needs it
  // doesn't require another prop threaded through StepEditorPanel.tsx.
  stepId: string;
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

// The hybrid pattern: most step types render from the generic SchemaForm; only these register
// a bespoke step editor here. A step type with no entry falls back to SchemaForm — see
// StepEditorPanel.tsx. Adding one is one component + one hook + one line here.
export const stepEditors: Record<string, ComponentType<StepEditorProps>> = {
  branches: Branches,
  communicate: Communicate,
  trigger: Trigger,
  go_to_action: GoToAction,
  schedule_interview: ScheduleInterview,
};
