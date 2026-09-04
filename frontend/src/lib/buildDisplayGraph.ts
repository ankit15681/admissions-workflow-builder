import type { Edge, Node } from "reactflow";
import type { Step } from "../types/workflow";
import type { StepClient } from "./stepClient";
import { workflowConfigToGraph } from "./graphMappers";
import type { PositionsById } from "./layoutGraph";

const ADD_OFFSET_Y = 110;
const END_OFFSET_Y = 190;

/**
 * The dashed Trigger/Action preview shown in place of the real graph on a brand-new
 * workflow (steps.length === 0) — a fixed, non-interactive illustration of the shape
 * ahead, matching the reference demo. None of these nodes are ever part of steps[]; they
 * only exist to prompt picking a trigger (WorkflowBuilderPage auto-opens ChooseTriggerPanel
 * for exactly this state).
 */
export function buildSkeletonGraph(): { nodes: Node[]; edges: Edge[] } {
  const dashedLine = { stroke: "#d4d4d8", strokeDasharray: "3 4" };
  const nodes: Node[] = [
    {
      id: "skeleton-trigger",
      type: "skeletonNode",
      position: { x: 80, y: 0 },
      data: { label: "Trigger", title: "1. Select the event that starts your automation" },
      draggable: false,
      // Deliberately NOT selectable: false — see the comment on AddStepNode's node
      // object below for why every clickable synthetic node here needs selectable: true.
      selectable: true,
    },
    { id: "skeleton-plus-1", type: "skeletonPlusNode", position: { x: 198, y: 112 }, data: {}, draggable: false, selectable: true },
    {
      id: "skeleton-action",
      type: "skeletonNode",
      position: { x: 80, y: 192 },
      data: { label: "Action", title: "2. Select an action" },
      draggable: false,
      selectable: true,
    },
    { id: "skeleton-plus-2", type: "skeletonPlusNode", position: { x: 198, y: 304 }, data: {}, draggable: false, selectable: true },
    { id: "skeleton-end", type: "endNode", position: { x: 178, y: 384 }, data: {}, draggable: false, selectable: false },
  ];
  const edges: Edge[] = [
    { id: "e-skel-1", source: "skeleton-trigger", target: "skeleton-plus-1", type: "straight", style: dashedLine },
    { id: "e-skel-2", source: "skeleton-plus-1", target: "skeleton-action", type: "straight", style: dashedLine },
    { id: "e-skel-3", source: "skeleton-action", target: "skeleton-plus-2", type: "straight", style: dashedLine },
    { id: "e-skel-4", source: "skeleton-plus-2", target: "skeleton-end", type: "straight", style: dashedLine },
  ];
  return { nodes, edges };
}

/**
 * Layers the canvas's UI-only affordances (the "+" insert buttons and dashed "End"
 * markers) on top of the pure config projection from workflowConfigToGraph. These
 * synthetic nodes are never part of a workflow's persisted steps[] — the canvas filters to
 * real stepNodes, and edits go through workflowOps, so they can't leak into the draft.
 * Positions come from the layout engine (`positions`), same as the real step nodes; each
 * synthetic node is placed relative to its parent step's computed position.
 */
export function buildDisplayGraph(steps: Step[], stepClient: StepClient, positions: PositionsById): { nodes: Node[]; edges: Edge[] } {
  const { nodes, edges } = workflowConfigToGraph(steps, stepClient, positions);
  const extraNodes: Node[] = [];
  const extraEdges: Edge[] = [];
  const posOf = (id: string) => positions[id] ?? { x: 0, y: 0 };

  steps.forEach((step, index) => {
    (nodes.find((n) => n.id === step.id)!.data as { index?: number }).index = index + 1;
    const def = stepClient[step.type];
    const outputs = def?.ports.outputs ?? [];
    const base = posOf(step.id);

    if (outputs.length === 0) {
      // A true terminal (Goal): nothing can follow it, just show where the run ends.
      const endId = `end-${step.id}`;
      extraNodes.push({
        id: endId,
        type: "endNode",
        position: { x: base.x + 98, y: base.y + ADD_OFFSET_Y },
        data: {},
        draggable: false,
        selectable: false,
      });
      extraEdges.push({
        id: `e-${step.id}-${endId}`,
        source: step.id,
        target: endId,
        type: "straight",
        style: { stroke: "#d4d4d8" },
      });
      return;
    }

    outputs.forEach((port, i) => {
      const wired = step.next.some((n) => n.portId === port.id);
      if (wired) return;
      const offsetX = (i - (outputs.length - 1) / 2) * 180;
      const addId = `add-${step.id}-${port.id}`;
      const endId = `end-${step.id}-${port.id}`;
      extraNodes.push({
        id: addId,
        type: "addStepNode",
        position: { x: base.x + 118 + offsetX, y: base.y + ADD_OFFSET_Y },
        data: { insertAfterStepId: step.id, portId: port.id },
        draggable: false,
        // React Flow only gives a node real pointer-events (vs. pointer-events: none on
        // its wrapper) when it's selectable and/or draggable — selectable: false here
        // left this button unclickable on a workflow's first-ever render (before any
        // other node-array update had happened to "wake" the wrapper's pointer-events),
        // which is exactly the state a brand-new workflow's only affordance starts in.
        // draggable stays false (we don't want it to actually move); selectable: true
        // just means clicking it may also mark it "selected" internally, which is inert
        // here since none of these synthetic node types render a selected-state style.
        selectable: true,
      });
      extraNodes.push({
        id: endId,
        type: "endNode",
        position: { x: base.x + 98 + offsetX, y: base.y + END_OFFSET_Y },
        data: {},
        draggable: false,
        selectable: false,
      });
      extraEdges.push({
        id: `e-${step.id}-${addId}`,
        source: step.id,
        sourceHandle: port.id,
        target: addId,
        type: "straight",
        style: { stroke: "#d4d4d8" },
        label: port.label,
      });
      extraEdges.push({
        id: `e-${addId}-${endId}`,
        source: addId,
        target: endId,
        type: "straight",
        style: { stroke: "#d4d4d8", strokeDasharray: "3 4" },
      });
    });
  });

  return { nodes: [...nodes, ...extraNodes], edges: [...edges, ...extraEdges] };
}
