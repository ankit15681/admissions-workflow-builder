import { useTrigger } from "../../../hooks/steps/useTrigger";
import { Select } from "../../fields/Select";
import { TextField } from "../../fields/TextField";
import "../editor.css";

interface Props {
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

// Pure rendering — event-conditional field selection lives in useTrigger.
export function Trigger({ config, onChange }: Props) {
  const view = useTrigger(config, onChange);

  if (view.kind === "form") {
    return (
      <div className="custom-editor">
        <Select label="Form" options={view.options} value={view.value} onChange={view.onChange} hint={view.hint} />
      </div>
    );
  }

  if (view.kind === "status") {
    return (
      <div className="custom-editor">
        <TextField
          label="Status"
          placeholder="e.g. Offer Accepted"
          value={view.value}
          onChange={view.onChange}
          hint={view.hint}
        />
      </div>
    );
  }

  return <div className="field__hint">No additional configuration for this trigger.</div>;
}
