import type { ConditionTypeDefinition } from "./types";
import { statusEqualsCondition } from "./statusEquals";
import { dateComparisonCondition } from "./dateComparison";
import { counterCondition } from "./counter";
import { documentStatusCondition } from "./documentStatus";
import { taskStatusCondition } from "./taskStatus";
import { interviewStatusCondition } from "./interviewStatus";

// Additive registry (C.6.2): a new condition type is one new module + one line here,
// never a change to the Branches editor or the executor.
export const conditionTypeRegistry: Record<string, ConditionTypeDefinition> = {
  [statusEqualsCondition.type]: statusEqualsCondition,
  [dateComparisonCondition.type]: dateComparisonCondition,
  [counterCondition.type]: counterCondition,
  [documentStatusCondition.type]: documentStatusCondition,
  [taskStatusCondition.type]: taskStatusCondition,
  [interviewStatusCondition.type]: interviewStatusCondition,
};

export function listConditionTypes(): ConditionTypeDefinition[] {
  return Object.values(conditionTypeRegistry);
}
