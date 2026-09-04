import React, { useCallback, useMemo, useState } from "react";
import ReactFlow, { Background, BackgroundVariant, type Node, type NodeChange } from "reactflow";
import "reactflow/dist/style.css";
import { buildDisplayGraph, buildSkeletonGraph } from "../../lib/buildDisplayGraph";
import { layoutSteps } from "../../lib/layoutGraph";
import { findClosestEdge, isReorderable } from "../../lib/dragReorder";
import { StepNode } from "./StepNode";
import { AddStepNode } from "./AddStepNode";
import { EndNode } from "./EndNode";
import { SkeletonNode, SkeletonPlusNode } from "./SkeletonNode";
import { StepEdge } from "./StepEdge";
import { ZoomBar } from "./ZoomBar";
import { useWorkflowEdit } from "../../state/WorkflowEditContext";
import { useCanvasStore } from "../../state/canvasStore";
import "./canvas.css";

const nodeTypes = {
  stepNode: StepNode,
  addStepNode: AddStepNode,
  endNode: EndNode,
  skeletonNode: SkeletonNode,
  skeletonPlusNode: SkeletonPlusNode,
};
const edgeTypes = { stepEdge: StepEdge };

export function WorkflowCanvas() {
  const { steps, stepClient, reorderStep } = useWorkflowEdit();
  const { dragOverEdge, setDragOverEdge } = useCanvasStore((s) => ({
    dragOverEdge: s.dragOverEdge,
    setDragOverEdge: s.setDragOverEdge,
  }));

  // Node positions are DERIVED from the graph shape (dagre), never stored on the step.
  // Recomputed only when steps change — not on every drag frame.
  const positions = useMemo(() => (steps.length === 0 ? {} : layoutSteps(steps)), [steps]);

  // A transient, per-drag position override. Pure auto-layout means a step has no stored
  // position, so React Flow (controlled) won't move a dragged node on its own — we hold its
  // live position here for visual feedback during the drag, then clear it on drop so the node
  // snaps to its freshly-computed layout spot (or its new spot, if the drop reordered it).
  const [dragOverlay, setDragOverlay] = useState<Record<string, { x: number; y: number }>>({});

  const base = useMemo(
    () => (steps.length === 0 ? buildSkeletonGraph() : buildDisplayGraph(steps, stepClient, positions)),
    [steps, stepClient, positions]
  );

  const nodes = useMemo(
    () => base.nodes.map((n) => (dragOverlay[n.id] ? { ...n, position: dragOverlay[n.id] } : n)),
    [base.nodes, dragOverlay]
  );

  // Highlight the one edge a reorder drag is hovering close enough to drop onto.
  const edges = useMemo(() => {
    if (!dragOverEdge) return base.edges;
    return base.edges.map((e) => (e.id === dragOverEdge.edgeId ? { ...e, data: { ...e.data, dropTarget: true } } : e));
  }, [base.edges, dragOverEdge]);

  // Live drag feedback: record the dragged step node's moving position in the overlay so it
  // follows the cursor. (Positions aren't persisted any more — this is display-only.)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setDragOverlay((prev) => {
        let nextOverlay = prev;
        for (const c of changes) {
          if (c.type === "position" && c.position && steps.some((s) => s.id === c.id)) {
            if (nextOverlay === prev) nextOverlay = { ...prev };
            nextOverlay[c.id] = c.position;
          }
        }
        return nextOverlay;
      });
    },
    [steps]
  );

  // While dragging a reorderable step, light up the nearest edge it could splice into.
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const step = steps.find((s) => s.id === node.id);
      if (!step || !isReorderable(step, stepClient)) {
        if (dragOverEdge) setDragOverEdge(null);
        return;
      }
      setDragOverEdge(findClosestEdge(steps, positions, node.id, node.position));
    },
    [steps, stepClient, positions, dragOverEdge, setDragOverEdge]
  );

  // On release: if we're over an edge, splice the step in there (pure edge edit — layout
  // repaints it). Either way clear the overlay so the node lands on its computed position
  // rather than wherever the cursor left it.
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (dragOverEdge) reorderStep(node.id, dragOverEdge);
      setDragOverEdge(null);
      setDragOverlay({});
    },
    [dragOverEdge, reorderStep, setDragOverEdge]
  );

  return (
    <div className="canvas-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        defaultViewport={{ x: 420, y: 80, zoom: 0.85 }}
        minZoom={0.3}
        maxZoom={1.75}
        proOptions={{ hideAttribution: true }}
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        selectionOnDrag={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#e4e4e7" />
        <ZoomBar />
        <svg width="0" height="0">
          <defs>
            <marker id="step-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" fill="#d4d4d8" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>
      <div className="canvas-hint">Drag a step onto an edge to reorder it · drag to pan · ⌘/Ctrl + scroll to zoom</div>
    </div>
  );
}
