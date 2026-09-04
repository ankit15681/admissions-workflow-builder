import dagre from "@dagrejs/dagre";
import type { Step } from "../types/workflow";

// Card dimensions (match .step-node's CSS width and its rendered height closely enough
// for layout — dagre only needs box sizes to space things, not pixel-perfect bounds).
export const NODE_W = 260;
export const NODE_H = 70;

export type PositionsById = Record<string, { x: number; y: number }>;

/**
 * Computes every step's canvas position from the workflow graph itself, top-down, using
 * dagre's layered algorithm. This is the whole point of dropping stored positions: a
 * workflow is a pure DAG (steps + next[] edges), and where each card *sits* is derived
 * from that shape on every render — never stored, never hand-maintained. Branch children
 * fan out naturally (dagre spaces siblings on the same rank), and go_to_action loop-back
 * edges are handled by the greedy acyclicer (it temporarily reverses back-edges just to
 * rank, so the loop target still sits above its source and the edge routes back up).
 *
 * dagre reports node centers; React Flow positions by top-left, hence the half-size shift.
 */
export function layoutSteps(steps: Step[]): PositionsById {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 60, ranksep: 80, marginx: 40, marginy: 40, acyclicer: "greedy" });
  g.setDefaultEdgeLabel(() => ({}));

  const ids = new Set(steps.map((s) => s.id));
  for (const s of steps) g.setNode(s.id, { width: NODE_W, height: NODE_H });
  for (const s of steps) {
    for (const n of s.next) {
      // Guard against a dangling edge to a since-removed step — never feed dagre an edge
      // whose endpoint isn't a node, or it throws.
      if (ids.has(n.targetId)) g.setEdge(s.id, n.targetId);
    }
  }

  dagre.layout(g);

  const positions: PositionsById = {};
  for (const s of steps) {
    const node = g.node(s.id);
    if (node) positions[s.id] = { x: node.x - NODE_W / 2, y: node.y - NODE_H / 2 };
  }
  return positions;
}
