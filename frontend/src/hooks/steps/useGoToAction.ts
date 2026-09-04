import { useWorkflowEdit } from "../../state/WorkflowEditContext";
import { titleFor } from "../../lib/stepClient";

// Data-logic hook for the Go To Action editor. "Jump to" edits the step's real next[] edge via
// setGoToTarget (not a config field); "Max iterations" is an ordinary config field. The hook
// owns the step-list -> options mapping and both bindings; the component just renders atoms.
export function useGoToAction(
  stepId: string,
  config: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void
) {
  const { steps, stepClient, setGoToTarget } = useWorkflowEdit();
  const currentStep = steps.find((s) => s.id === stepId);
  const targetId = currentStep?.next[0]?.targetId ?? "";

  const options = steps
    .map((s, i) => ({ step: s, index: i + 1 }))
    .filter(({ step }) => step.id !== stepId)
    .map(({ step, index }) => ({ value: step.id, label: `${index}. ${titleFor(stepClient[step.type], step.config)}` }));

  return {
    options,
    targetId,
    setTarget: (v: string) => setGoToTarget(stepId, v),
    maxIterations: config.maxIterations as number | undefined,
    setMaxIterations: (v: number | undefined) => onChange({ ...config, maxIterations: v }),
  };
}
