import React from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Plus } from "lucide-react";
import { useCanvasStore } from "../../state/canvasStore";

export interface AddStepNodeData {
  insertAfterStepId: string;
  portId: string;
}

/** The terminal "+" — appended after a step whose output port has nothing wired yet. */
export function AddStepNode({ data }: NodeProps<AddStepNodeData>) {
  const openChooseAction = useCanvasStore((s) => s.openChooseAction);
  return (
    <div>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <button
        className="add-step-btn"
        onClick={() => openChooseAction(data.insertAfterStepId, data.portId)}
        aria-label="Add step"
      >
        <Plus size={14} />
      </button>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
