import { useCommunicate } from "../../../hooks/steps/useCommunicate";
import { Select } from "../../fields/Select";
import { TextField } from "../../fields/TextField";
import "../editor.css";

interface Props {
  config: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

// Pure rendering — recipient-aware variable logic, cursor insertion and bindings live in
// useCommunicate.
export function Communicate({ config, onChange }: Props) {
  const c = useCommunicate(config, onChange);
  return (
    <div className="custom-editor">
      <Select label="Send to" options={c.recipientOptions} value={c.recipient} onChange={c.setRecipient} />
      <TextField label="Subject" value={c.subject} onChange={c.setSubject} />
      <TextField textarea label="Message" value={c.message} onChange={c.setMessage} textareaRef={c.messageRef} />

      <div className="field">
        <label className="field__label">Insert a variable</label>
        <div className="variable-picker">
          {c.variables.map((v) => (
            <button key={v.key} type="button" className="variable-chip" onClick={() => c.insertVariable(v.key)}>
              {`{{${v.key}}}`}
            </button>
          ))}
        </div>
        <div className="field__hint">Only variables valid for &quot;{c.recipientLabel}&quot; are offered.</div>
      </div>
    </div>
  );
}
