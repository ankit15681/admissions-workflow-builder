import type { Ref } from "react";
import { useTextField } from "../../hooks/fields/useTextField";

// Atomic design-system field: a controlled text input (or textarea). Presentational —
// its committed value comes in via `value` and goes out via `onChange`; it holds no
// committed state of its own. Pairs with useTextField for ephemeral touched/error logic.
// An external `error` (e.g. from a schema validator) takes precedence over the derived one.
export interface TextFieldProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  textarea?: boolean;
  error?: string | null;
  textareaRef?: Ref<HTMLTextAreaElement>;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  textarea,
  error,
  textareaRef,
}: TextFieldProps) {
  const { error: derived, markTouched } = useTextField({ value, required });
  const shownError = error ?? derived;
  return (
    <div className="field">
      {label && (
        <label className="field__label">
          {label}
          {required && <span className="field__required">*</span>}
        </label>
      )}
      {textarea ? (
        <textarea
          ref={textareaRef}
          className="field__textarea"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={markTouched}
        />
      ) : (
        <input
          className="field__input"
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onBlur={markTouched}
        />
      )}
      {hint && <div className="field__hint">{hint}</div>}
      {shownError && <div className="field__error">{shownError}</div>}
    </div>
  );
}
