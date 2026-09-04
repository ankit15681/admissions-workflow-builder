import { useGoToAction } from "../../../hooks/steps/useGoToAction";
import { Select } from "../../fields/Select";
import { NumberField } from "../../fields/NumberField";
import "../editor.css";

interface Props {
  stepId: string;
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

// Pure rendering — step-list options, the edge target binding (setGoToTarget) and the
// maxIterations binding live in useGoToAction.
export function GoToAction({ stepId, config, onChange }: Props) {
  const g = useGoToAction(stepId, config, onChange);
  return (
    <div className="custom-editor">
      <Select
        label="Jump to"
        required
        options={g.options}
        value={g.targetId}
        onChange={g.setTarget}
        hint="Which step this run resumes from when the cap below hasn't been hit yet."
      />
      <NumberField
        label="Max iterations"
        required
        min={1}
        value={g.maxIterations}
        onChange={g.setMaxIterations}
        hint="Hard platform cap on how many times this jump can be taken within one run."
      />
    </div>
  );
}
