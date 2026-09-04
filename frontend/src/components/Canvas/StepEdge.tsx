import React from "react";
import { EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "reactflow";
import { Plus } from "lucide-react";
import { useCanvasStore } from "../../state/canvasStore";

export interface StepEdgeData {
  sourceStepId: string;
  portId: string;
  targetStepId: string;
  // Set (by WorkflowCanvas, from canvasStore's dragOverEdge) on the one edge a
  // currently-dragged, reorderable step is close enough to that dropping now would
  // splice it in right here — see lib/dragReorder's findClosestEdge.
  dropTarget?: boolean;
}

/** An ordinary edge between two real steps, with a "+" at its midpoint to insert a new
 * step in between — the demo's on-edge insertion affordance, not just at the graph's end.
 * While some other step is being dragged near enough to this edge, the "+" gives way to a
 * highlighted "Drop to insert here" indicator instead (data.dropTarget), so reordering a
 * step into the chain has the same kind of explicit, visible target the "+" already gives
 * inserting a brand-new one. */
export function StepEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  label,
  data,
}: EdgeProps<StepEdgeData>) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const openChooseAction = useCanvasStore((s) => s.openChooseAction);
  const dropTarget = !!data?.dropTarget;

  const pathStyle = dropTarget
    ? { ...style, stroke: "var(--color-focus)", strokeWidth: 2.5 }
    : style;

  return (
    <>
      <path id={id} className="react-flow__edge-path" d={edgePath} style={pathStyle} markerEnd="url(#step-arrow)" />
      {label ? (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -140%) translate(${labelX}px,${labelY}px)`,
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-text-faint)",
              background: "var(--color-canvas-bg)",
              padding: "0 4px",
              pointerEvents: "none",
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      <EdgeLabelRenderer>
        <div
          style={{ position: "absolute", transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, pointerEvents: "all" }}
        >
          {dropTarget ? (
            <div className="drop-indicator" aria-hidden>
              Drop to insert here
            </div>
          ) : (
            <button
              className="add-step-btn"
              style={{ width: 20, height: 20 }}
              onClick={() => data && openChooseAction(data.sourceStepId, data.portId, data.targetStepId)}
              aria-label="Insert step"
            >
              <Plus size={12} />
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
