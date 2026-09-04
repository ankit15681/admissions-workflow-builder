import type { Step } from "../types/workflow";
import type { StepClient } from "./stepClient";
import { NODE_W, NODE_H, type PositionsById } from "./layoutGraph";

// How close (in flow-space units — unaffected by zoom, since positions are flow-space)
// the dragged node's center has to get to an edge's line before that edge lights up as
// a drop target — close enough to feel intentional, far enough that passing near an
// unrelated edge a row away doesn't light it up by accident.
const DROP_THRESHOLD = 90;

export interface DragOverEdge {
  edgeId: string;
  sourceStepId: string;
  portId: string;
  targetStepId: string;
}

function centerOf(position: { x: number; y: number }) {
  return { x: position.x + NODE_W / 2, y: position.y + NODE_H / 2 };
}

function distanceToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Can `step` be picked up and spliced into a different edge elsewhere in the chain?
 * Only a step with exactly one outgoing edge has one obvious "next" to reconnect
 * through on the far side once it lands — a Branches step's two outputs (which one
 * continues the chain past the drop point?) or a Goal's zero make the splice
 * ambiguous, so dragging one of those does nothing — it just snaps back to its
 * computed position on release. The Trigger (steps[0]) is never reorderable either.
 */
export function isReorderable(step: Step, stepClient: StepClient): boolean {
  if (step.type === "trigger") return false;
  const outputs = stepClient[step.type]?.ports.outputs ?? [];
  return outputs.length === 1;
}

/**
 * Finds the nearest real step-to-step edge — skipping any edge that touches
 * `draggedStepId` itself as source or target, since splicing a step into its own edge
 * is meaningless — to `draggedPosition`, within DROP_THRESHOLD. Node positions come from
 * the `positions` map (the layout engine's output); the dragged node's live position is
 * passed separately since it's mid-drag and not in the map. The edge id format
 * (`${sourceId}-${portId}-${targetId}`) matches graphMappers.ts's workflowConfigToGraph
 * exactly, so the id returned here always matches a real rendered edge. This is the one
 * place that decides "which edge would this land on", used by both the live drag
 * indicator and the eventual drop — so they can never disagree about the target.
 */
export function findClosestEdge(
  steps: Step[],
  positions: PositionsById,
  draggedStepId: string,
  draggedPosition: { x: number; y: number }
): DragOverEdge | null {
  const draggedCenter = centerOf(draggedPosition);
  let closest: DragOverEdge | null = null;
  let closestDist = DROP_THRESHOLD;

  for (const step of steps) {
    if (step.id === draggedStepId) continue;
    const sourcePos = positions[step.id];
    if (!sourcePos) continue;
    for (const n of step.next) {
      if (n.targetId === draggedStepId) continue;
      const targetPos = positions[n.targetId];
      if (!targetPos) continue;
      const dist = distanceToSegment(draggedCenter, centerOf(sourcePos), centerOf(targetPos));
      if (dist < closestDist) {
        closestDist = dist;
        closest = { edgeId: `${step.id}-${n.portId}-${n.targetId}`, sourceStepId: step.id, portId: n.portId, targetStepId: n.targetId };
      }
    }
  }
  return closest;
}
