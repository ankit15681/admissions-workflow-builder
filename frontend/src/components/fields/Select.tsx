import { useSelectField } from "../../hooks/fields/useSelectField";

export interface SelectOption {
  value: string;
  label: string;
}

// Atomic design-system field: a controlled dropdown. Pairs with useSelectField.
export interface SelectProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  hint?: string;
  required?: boolean;
  error?: string | null;
}

export function Select({ label, value, onChange, options, hint, required, error }: SelectProps) {
  const { error: derived, markTouched } = useSelectField({ value, required });
  const shownError = error ?? derived;
  return (
    <div className="field">
      {label && (
        <label className="field__label">
          {label}
          {required && <span className="field__required">*</span>}
        </label>
      )}
      <select className="field__select" value={value} onChange={(e) => onChange(e.target.value)} onBlur={markTouched}>
        <option value="" disabled>
          Select…
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <div className="field__hint">{hint}</div>}
      {shownError && <div className="field__error">{shownError}</div>}
    </div>
  );
}
