import React from "react";
import "./modal.css";

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Generic confirmation modal — same styled overlay/card as NameWorkflowModal, reused here
 * for irreversible actions (deleting a workflow) instead of the browser's own
 * window.confirm, for the same reason the naming flow moved off window.prompt: it can't be
 * styled and looks like it belongs to the browser chrome, not the app.
 */
export function ConfirmModal({ title, message, confirmLabel, danger, onConfirm, onCancel }: Props) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
      >
        <div className="modal__title">{title}</div>
        <div className="modal__message">{message}</div>
        <div className="modal__actions">
          <button type="button" className="btn btn--secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className={`btn ${danger ? "btn--danger" : "btn--primary"}`} onClick={onConfirm} autoFocus>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
