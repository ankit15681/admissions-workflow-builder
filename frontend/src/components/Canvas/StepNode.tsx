import React from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { AlertCircle, AlertTriangle } from "lucide-react";
import type { Step } from "../../types/workflow";
import type { StepTypeDefinition } from "../../types/stepTypes";
import { iconFor, colorFor, titleFor, summarizeStep } from "../../lib/stepClient";
import { useCanvasStore } from "../../state/canvasStore";
import { useWorkflowEdit } from "../../state/WorkflowEditContext";
import "./canvas.css";

export interface StepNodeData {
  step: Step;
  def: StepTypeDefinition | undefined;
  index: number;
}

// The one generic node type React Flow ever registers (C.6.3) — it has no idea
// Communicate and Delay are different things; everything it renders comes from the
// registry lookup (data.def), never a hardcoded switch on step type.
export function StepNode({ data, selected }: NodeProps<StepNodeData>) {
  const { step, def, index } = data;
  const openEditStep = useCanvasStore((s) => s.openEditStep);
  const { issues } = useWorkflowEdit();
  const Icon = iconFor(def?.icon ?? "zap");
  const color = colorFor(def?.color ?? "slate");
  const outputs = def?.ports.outputs ?? [];

  // Badge this card if it has any validation issue (error wins over warning).
  const stepIssues = issues.filter((i) => i.stepId === step.id);
  const badge = stepIssues.some((i) => i.level === "error") ? "error" : stepIssues.length > 0 ? "warning" : null;

  return (
    <div
      className={`step-node${selected ? " step-node--selected" : ""}`}
      style={{ borderLeftColor: color }}
      onClick={() => openEditStep(step.id)}
    >
      {badge && (
        <span className={`step-node__badge step-node__badge--${badge}`} title={stepIssues.map((i) => i.message).join("\n")}>
          {badge === "error" ? <AlertCircle size={14} /> : <AlertTriangle size={14} />}
        </span>
      )}
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="step-node__icon" style={{ backgroundColor: color }}>
        <Icon size={16} color="#fff" strokeWidth={2} />
      </div>
      <div className="step-node__body">
        <div className="step-node__category" style={{ color }}>
          {def?.label ?? step.type}
        </div>
        <div className="step-node__title">
          {index}. {titleFor(def, step.config)}
        </div>
        <div className="step-node__subtitle">{summarizeStep(def, step.config)}</div>
      </div>

      {outputs.length <= 1 ? (
        <Handle type="source" position={Position.Bottom} id={outputs[0]?.id ?? "next"} style={{ opacity: 0 }} />
      ) : (
        outputs.map((port, i) => (
          <Handle
            key={port.id}
            type="source"
            position={Position.Bottom}
            id={port.id}
            style={{ opacity: 0, left: `${((i + 1) / (outputs.length + 1)) * 100}%` }}
          />
        ))
      )}
    </div>
  );
}
