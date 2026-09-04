import { X } from "lucide-react";
import { useTagList } from "../../hooks/fields/useTagList";

// Atomic design-system field: an editable list of string tags (chips + add input).
// The committed string[] comes in via `value` / goes out via `onChange`; the in-progress
// add-input text is ephemeral, owned by useTagList.
export interface TagListProps {
  label?: string;
  value: string[];
  onChange: (v: string[]) => void;
  hint?: string;
  required?: boolean;
  error?: string | null;
}

export function TagList({ label, value, onChange, hint, required, error }: TagListProps) {
  const { text, setText, add, removeAt } = useTagList({ value, onChange });
  return (
    <div className="field">
      {label && (
        <label className="field__label">
          {label}
          {required && <span className="field__required">*</span>}
        </label>
      )}
      <div className="tag-list">
        {value.map((item, i) => (
          <span className="tag-chip" key={i}>
            {item}
            <button type="button" onClick={() => removeAt(i)} aria-label={`Remove ${item}`}>
              <X size={11} />
            </button>
          </span>
        ))}
        <input
          className="tag-input"
          placeholder="Add…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && text.trim()) {
              add();
              e.preventDefault();
            }
          }}
        />
      </div>
      {hint && <div className="field__hint">{hint}</div>}
      {error && <div className="field__error">{error}</div>}
    </div>
  );
}
