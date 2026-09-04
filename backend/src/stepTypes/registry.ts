import type { StepTypeDefinition } from "./types";
import { triggerStepType } from "./trigger";
import { delayStepType } from "./delay";
import { branchesStepType } from "./branches";
import { communicateStepType } from "./communicate";
import { setStatusStepType } from "./setStatus";
import { goToActionStepType } from "./goToAction";
import { goalStepType } from "./goal";
import { requestDocumentStepType } from "./requestDocument";
import { assignTaskStepType } from "./assignTask";
import { scheduleInterviewStepType } from "./scheduleInterview";

// The single canonical registry — same one the Step Executor uses to run each step
// and that GET /api/step-types serialises the public projection of (C.6.1). Adding a
// step type is one new module + one line here.
export const stepTypeRegistry: Record<string, StepTypeDefinition> = {
  [triggerStepType.type]: triggerStepType,
  [delayStepType.type]: delayStepType,
  [branchesStepType.type]: branchesStepType,
  [communicateStepType.type]: communicateStepType,
  [setStatusStepType.type]: setStatusStepType,
  [goToActionStepType.type]: goToActionStepType,
  [goalStepType.type]: goalStepType,
  [requestDocumentStepType.type]: requestDocumentStepType,
  [assignTaskStepType.type]: assignTaskStepType,
  [scheduleInterviewStepType.type]: scheduleInterviewStepType,
};

export function listStepTypes(): StepTypeDefinition[] {
  return Object.values(stepTypeRegistry);
}
