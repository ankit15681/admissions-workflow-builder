// Atomic design-system field: a controlled checkbox. No paired logic hook — it carries no
// ephemeral state (its committed boolean is the whole story).
export interface CheckboxProps {
  label?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}

export function Checkbox({ label, value, onChange, hint }: CheckboxProps) {
  return (
    <div className="field field--checkbox">
      <label className="field__checkbox-label">
        <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
        {label}
      </label>
      {hint && <div className="field__hint">{hint}</div>}
    </div>
  );
}
