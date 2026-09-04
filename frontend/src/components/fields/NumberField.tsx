import { useNumberField } from "../../hooks/fields/useNumberField";

// Atomic design-system field: a controlled number input. The string->number parsing and
// required/min validation live in useNumberField; this component just renders. An external
// `error` takes precedence over the derived one.
export interface NumberFieldProps {
  label?: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  hint?: string;
  required?: boolean;
  error?: string | null;
}

export function NumberField({ label, value, onChange, min, hint, required, error }: NumberFieldProps) {
  const { error: derived, markTouched, parse } = useNumberField({ value, required, min });
  const shownError = error ?? derived;
  return (
    <div className="field">
      {label && (
        <label className="field__label">
          {label}
          {required && <span className="field__required">*</span>}
        </label>
      )}
      <input
        className="field__input"
        type="number"
        min={min}
        value={value ?? ""}
        onChange={(e) => onChange(parse(e.target.value))}
        onBlur={markTouched}
      />
      {hint && <div className="field__hint">{hint}</div>}
      {shownError && <div className="field__error">{shownError}</div>}
    </div>
  );
}
