import React from "react";
import { Plus, Pencil, Trash2, Undo2, Redo2, AlertCircle, AlertTriangle } from "lucide-react";
import { useCanvasStore } from "../state/canvasStore";
import type { Workflow } from "../types/workflow";
import type { SaveStatus } from "../state/WorkflowEditContext";
import "./topBar.css";

interface Props {
  workflows: Workflow[];
  currentWorkflow: Workflow;
  onSelectWorkflow: (id: string) => void;
  onCreateWorkflow: () => void;
  onRenameWorkflow: () => void;
  onDeleteWorkflow: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onPublish: () => void;
  onUnpublish: () => void;
  saveStatus: SaveStatus;
  isPublishing: boolean;
  isUnpublishing: boolean;
  errorCount: number;
  warningCount: number;
  onShowIssues: () => void;
}

const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  conflict: "Reloaded latest draft",
  error: "Save failed",
};

export function TopBar({
  workflows,
  currentWorkflow,
  onSelectWorkflow,
  onCreateWorkflow,
  onRenameWorkflow,
  onDeleteWorkflow,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onPublish,
  onUnpublish,
  saveStatus,
  isPublishing,
  isUnpublishing,
  errorCount,
  warningCount,
  onShowIssues,
}: Props) {
  const { leftPanelVisible, toggleLeftPanel } = useCanvasStore((s) => ({
    leftPanelVisible: s.leftPanelVisible,
    toggleLeftPanel: s.toggleLeftPanel,
  }));

  // A brand-new workflow (no Trigger configured yet) reads as "EXAMPLE" rather than
  // "DRAFT" — it isn't really an in-progress flow until a trigger exists — reusing the
  // same amber styling as the draft badge.
  const isUnconfigured = currentWorkflow.draftSteps.length === 0;

  return (
    <div className="top-bar">
      <div className="top-bar__left">
        <button
          className="top-bar__brand"
          onClick={onCreateWorkflow}
          aria-label="New workflow"
          title="New workflow"
        >
          <Plus size={14} color="#fff" />
        </button>
        <span className="top-bar__crumb">Workflows</span>
        <span className="top-bar__sep">/</span>
        <select
          className="top-bar__workflow-select"
          value={currentWorkflow.id}
          onChange={(e) => onSelectWorkflow(e.target.value)}
        >
          {workflows.map((wf) => (
            <option key={wf.id} value={wf.id}>
              {wf.name}
            </option>
          ))}
        </select>
        <button className="top-bar__rename-btn" onClick={onRenameWorkflow} aria-label="Rename workflow" title="Rename workflow">
          <Pencil size={13} />
        </button>
        <button
          className="top-bar__rename-btn top-bar__delete-btn"
          onClick={onDeleteWorkflow}
          aria-label="Delete workflow"
          title="Delete workflow"
        >
          <Trash2 size={13} />
        </button>
        <span className={`top-bar__badge top-bar__badge--${isUnconfigured ? "draft" : currentWorkflow.status}`}>
          {isUnconfigured ? "EXAMPLE" : currentWorkflow.status === "published" ? "PUBLISHED" : "DRAFT"}
        </span>
      </div>

      <div className="top-bar__right">
        <span className="top-bar__save-status">{SAVE_STATUS_LABEL[saveStatus]}</span>
        {(errorCount > 0 || warningCount > 0) && (
          <button
            className={`top-bar__issues top-bar__issues--${errorCount > 0 ? "error" : "warning"}`}
            onClick={onShowIssues}
            title="Show workflow checks"
          >
            {errorCount > 0 ? <AlertCircle size={13} /> : <AlertTriangle size={13} />}
            {errorCount > 0 ? `${errorCount} error${errorCount > 1 ? "s" : ""}` : `${warningCount} warning${warningCount > 1 ? "s" : ""}`}
          </button>
        )}
        <button
          className="top-bar__icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (⌘/Ctrl+Z)"
        >
          <Undo2 size={15} />
        </button>
        <button
          className="top-bar__icon-btn"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (⌘/Ctrl+Shift+Z)"
        >
          <Redo2 size={15} />
        </button>
        <button className="btn btn--secondary" onClick={toggleLeftPanel}>
          {leftPanelVisible ? "Hide panel" : "Show panel"}
        </button>
        <button className="btn btn--secondary" onClick={onCreateWorkflow}>
          New workflow
        </button>
        {currentWorkflow.status === "published" ? (
          <button className="btn btn--secondary" onClick={onUnpublish} disabled={isUnpublishing}>
            {isUnpublishing ? "Unpublishing…" : "Unpublish"}
          </button>
        ) : (
          <button
            className="btn btn--primary"
            onClick={onPublish}
            disabled={isPublishing || errorCount > 0}
            title={errorCount > 0 ? "Fix the errors before publishing" : undefined}
          >
            {isPublishing ? "Publishing…" : "Publish"}
          </button>
        )}
      </div>
    </div>
  );
}
