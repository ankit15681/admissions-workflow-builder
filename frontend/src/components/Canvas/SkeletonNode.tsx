import React from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Zap, Plus } from "lucide-react";
import { useCanvasStore } from "../../state/canvasStore";
import "./canvas.css";

export interface SkeletonNodeData {
  label: string;
  title: string;
}

/**
 * The dashed Trigger/Action preview shown only on a brand-new, unconfigured workflow
 * (steps.length === 0) — mirrors the reference demo's "pick a trigger to get started"
 * hint instead of a blank canvas. Nothing here is a real step; clicking any part of it
 * opens the trigger picker, since no other configuration is possible before a trigger
 * exists (see buildDisplayGraph.ts's buildSkeletonGraph).
 */
export function SkeletonNode({ data }: NodeProps<SkeletonNodeData>) {
  const openChooseTrigger = useCanvasStore((s) => s.openChooseTrigger);
  return (
    <div className="step-node step-node--ghost" onClick={openChooseTrigger}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="step-node__icon">
        <Zap size={16} strokeWidth={2} />
      </div>
      <div className="step-node__body">
        <div className="step-node__category">{data.label}</div>
        <div className="step-node__title">{data.title}</div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

/** The "+" connecting the skeleton's placeholder cards — also opens the trigger picker. */
export function SkeletonPlusNode() {
  const openChooseTrigger = useCanvasStore((s) => s.openChooseTrigger);
  return (
    <div>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <button className="add-step-btn" onClick={openChooseTrigger} aria-label="Choose a trigger">
        <Plus size={14} />
      </button>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}
