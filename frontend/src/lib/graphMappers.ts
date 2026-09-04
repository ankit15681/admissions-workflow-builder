import type { Edge, Node } from "reactflow";
import type { Step } from "../types/workflow";
import type { StepClient } from "./stepClient";
import type { PositionsById } from "./layoutGraph";

// The config-to-graph projection (design doc C.6.3): a workflow's steps[] is the only
// source of truth and the canvas is a pure projection of it. One generic React Flow node
// type ("stepNode") is used always — React Flow has no idea Communicate and Delay differ;
// StepNode reads the registry lookup (data.def) to render each card.
//
// Node *positions* are not stored on the step any more — they're computed from the graph
// shape by layoutSteps() (dagre) and passed in here. (The design doc's reverse mapper,
// graphToWorkflowConfig, is intentionally gone: edits are applied straight to steps[] via
// lib/workflowOps, so there's never a canvas-graph -> config round-trip to perform.)

export function workflowConfigToGraph(steps: Step[], stepClient: StepClient, positions: PositionsById): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = steps.map((step) => ({
    id: step.id,
    type: "stepNode",
    position: positions[step.id] ?? { x: 0, y: 0 },
    data: { step, def: stepClient[step.type] },
    draggable: true,
  }));

  const edges: Edge[] = steps.flatMap((step) =>
    step.next.map((n) => ({
      id: `${step.id}-${n.portId}-${n.targetId}`,
      source: step.id,
      sourceHandle: n.portId,
      target: n.targetId,
      type: "stepEdge",
      style:
        step.type === "go_to_action"
          ? { strokeDasharray: "5 5", stroke: "#9a9aa4" }
          : { stroke: "#d4d4d8" },
      label: n.portId === "yes" ? "Yes" : n.portId === "no" ? "No" : undefined,
      data: { sourceStepId: step.id, portId: n.portId, targetStepId: n.targetId },
    }))
  );

  return { nodes, edges };
}
