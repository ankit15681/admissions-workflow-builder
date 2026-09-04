import { useBranches } from "../../../hooks/steps/useBranches";
import { SchemaForm } from "../SchemaForm";
import { Select } from "../../fields/Select";
import "../editor.css";

interface Props {
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

// Pure rendering — condition fetch, selection and type-change reset live in useBranches.
export function Branches({ config, onChange }: Props) {
  const b = useBranches(config, onChange);
  if (b.loading) return <div className="field__hint">Loading condition types…</div>;

  return (
    <div className="custom-editor">
      <Select
        label="Condition"
        options={b.options}
        value={b.conditionType}
        onChange={b.setConditionType}
        hint={b.selected?.description}
      />

      {b.selected && (
        <SchemaForm schema={b.selected.configSchema} value={b.conditionConfig} onChange={b.setConditionConfig} />
      )}

      <div className="condition-preview">
        The <strong>Yes</strong> output fires when this is true, evaluated fresh against live data the moment this
        step is reached — never assumed from when the run started. The <strong>No</strong> output fires otherwise.
      </div>
    </div>
  );
}
