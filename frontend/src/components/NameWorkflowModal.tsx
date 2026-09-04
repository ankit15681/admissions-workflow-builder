import React, { useState } from "react";
import "./modal.css";

interface Props {
  title: string;
  submitLabel: string;
  initialName?: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

/**
 * A real modal for naming a workflow — used both for "New workflow" (create a name
 * before the workflow exists) and for renaming the current one, rather than the
 * browser's own window.prompt (which can't be styled and reads as a dead end once
 * dismissed — see bug report: users expected to be able to edit the name afterward too).
 */
export function NameWorkflowModal({ title, submitLabel, initialName = "", onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initialName);

  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal__title">{title}</div>
        <input
          className="field__input"
          autoFocus
          placeholder="Workflow name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
        />
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
