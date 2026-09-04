import React from "react";
import { X, AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useWorkflowEdit } from "../../state/WorkflowEditContext";
import { useCanvasStore } from "../../state/canvasStore";
import "./editor.css";

/**
 * Lists the current draft's workflow-integrity issues (lib/validateWorkflow). Errors block
 * publishing; warnings don't. Clicking an issue that's tied to a step opens that step's
 * editor so it's one click from "what's wrong" to "fix it".
 */
export function ValidationPanel() {
  const { issues, steps } = useWorkflowEdit();
  const { closePanel, openEditStep } = useCanvasStore((s) => ({ closePanel: s.closePanel, openEditStep: s.openEditStep }));

  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");
  const stepIndex = (id?: string) => (id ? steps.findIndex((s) => s.id === id) + 1 : 0);

  return (
    <div className="editor-panel">
      <div className="editor-panel__header">
        <div className="editor-panel__header-text">
          <div className="editor-panel__title">Workflow checks</div>
        </div>
        <button className="editor-panel__close" onClick={closePanel} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="editor-panel__body">
        {issues.length === 0 ? (
          <div className="validation-ok">
            <CheckCircle2 size={18} />
            <span>No issues — this workflow is ready to publish.</span>
          </div>
        ) : (
          <>
            <div className="validation-summary">
              {errors.length > 0 && <span className="validation-count validation-count--error">{errors.length} error{errors.length > 1 ? "s" : ""}</span>}
              {warnings.length > 0 && <span className="validation-count validation-count--warning">{warnings.length} warning{warnings.length > 1 ? "s" : ""}</span>}
            </div>
            {[...errors, ...warnings].map((issue, i) => {
              const idx = stepIndex(issue.stepId);
              const stepLabel = issue.stepId ? `Step ${idx}` : "Workflow";
              return (
                <button
                  key={`${issue.code}-${issue.stepId ?? "wf"}-${i}`}
                  className={`validation-item validation-item--${issue.level}`}
                  onClick={() => issue.stepId && openEditStep(issue.stepId)}
                  disabled={!issue.stepId}
                >
                  {issue.level === "error" ? <AlertCircle size={15} /> : <AlertTriangle size={15} />}
                  <span className="validation-item__text">
                    <span className="validation-item__where">{stepLabel}</span>
                    {issue.message}
                  </span>
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
