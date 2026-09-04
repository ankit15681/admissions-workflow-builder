import React from "react";
import { X, Trash2 } from "lucide-react";
import { useWorkflowEdit } from "../../state/WorkflowEditContext";
import { useCanvasStore } from "../../state/canvasStore";
import { iconFor, colorFor, titleFor } from "../../lib/stepClient";
import { stepEditors } from "./steps";
import { SchemaForm } from "./SchemaForm";
import "./editor.css";

export function StepEditorPanel({ stepId }: { stepId: string }) {
  const { steps, stepClient, updateStepConfig, removeStep } = useWorkflowEdit();
  const { closePanel, openChooseTrigger } = useCanvasStore((s) => ({
    closePanel: s.closePanel,
    openChooseTrigger: s.openChooseTrigger,
  }));

  const step = steps.find((s) => s.id === stepId);
  if (!step) return null;
  const def = stepClient[step.type];
  const Icon = iconFor(def?.icon ?? "zap");
  const color = colorFor(def?.color ?? "slate");
  const index = steps.findIndex((s) => s.id === stepId) + 1;

  const Custom = stepEditors[step.type];
  const isTrigger = step.type === "trigger";

  return (
    <div className="editor-panel">
      <div className="editor-panel__header">
        <div className="editor-panel__header-icon" style={{ backgroundColor: color }}>
          <Icon size={15} color="#fff" />
        </div>
        <div className="editor-panel__header-text">
          <div className="editor-panel__category" style={{ color }}>
            {def?.label ?? step.type}
          </div>
          <div className="editor-panel__title">
            {isTrigger ? titleFor(def, step.config) : `Step ${index}`}
          </div>
        </div>
        <button className="editor-panel__close" onClick={closePanel} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="editor-panel__body">
        {Custom ? (
          <Custom stepId={step.id} config={step.config} onChange={(next) => updateStepConfig(step.id, next)} />
        ) : def ? (
          <SchemaForm schema={def.configSchema} value={step.config} onChange={(next) => updateStepConfig(step.id, next)} />
        ) : (
          <div className="field__hint">Unknown step type &quot;{step.type}&quot;.</div>
        )}
      </div>

      <div className="editor-panel__footer">
        {isTrigger ? (
          <button className="btn--danger-link" onClick={openChooseTrigger}>
            <Trash2 size={14} />
            Change trigger
          </button>
        ) : (
          <button
            className="btn--danger-link"
            onClick={() => {
              removeStep(step.id);
              closePanel();
            }}
          >
            <Trash2 size={14} />
            Remove
          </button>
        )}
        <button className="btn btn--primary" onClick={closePanel}>
          Done
        </button>
      </div>
    </div>
  );
}
