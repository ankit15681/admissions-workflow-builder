import type { Step } from "../types/workflow";
import type { StepClient } from "./stepClient";

/**
 * Every graph edit is a pure `steps[] -> steps[]` transform, gathered here.
 *
 * `steps[]` is the whole source of truth for a workflow (C.6.3) — the canvas is just a
 * projection of it — so "editing the workflow" *is* transforming this array. Keeping
 * these as pure functions (no React, no component state) means each one can be reasoned
 * about and unit-tested on its own, and the page/hook that owns the state just does
 * `apply(prev => op(prev, ...))`. This is also where the two bug-prone splice paths
 * (remove and reorder) share one helper instead of each hand-rolling edge reconnection.
 *
 * There is deliberately NO position math here. A step carries no `position`; the canvas
 * derives every node's coordinates from the graph shape via lib/layoutGraph.ts on render.
 * That's what makes these transforms so small — inserting or reordering a step is purely
 * an edge edit, and the whole class of "cards overlap" bugs simply can't occur.
 */

/** Generates a new step id. Exposed so callers that need the id up front (e.g. to open the
 * new step's editor) can pass it into insertStep rather than fish it out afterward. */
export function newStepId(): string {
  return `step-${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Redirects every edge that currently points AT `stepId` to point at `throughId`
 * instead (or drops the edge entirely if `throughId` is null), leaving `stepId` itself
 * in the array untouched. This is the shared heart of both removing a step (splice it
 * out and reconnect its predecessors to its successor) and reordering one (detach it
 * from its current position before re-attaching elsewhere). Generalises correctly when a
 * step has more than one incoming edge (e.g. it's also a go_to_action loop-back target):
 * every matching edge, wherever it lives, is remapped.
 */
function redirectIncoming(steps: Step[], stepId: string, throughId: string | null): Step[] {
  return steps.map((s) =>
    s.id === stepId
      ? s
      : {
          ...s,
          next: s.next.flatMap((n) => {
            if (n.targetId !== stepId) return [n];
            return throughId ? [{ ...n, targetId: throughId }] : [];
          }),
        }
  );
}

/** Replaces one step's config (the editor panel's every keystroke goes through here). */
export function updateStepConfig(steps: Step[], stepId: string, config: Record<string, unknown>): Step[] {
  return steps.map((s) => (s.id === stepId ? { ...s, config } : s));
}

export interface InsertStepArgs {
  afterStepId: string;
  portId: string;
  stepType: string;
  /** Set when inserting onto an existing edge (mid-edge "+"); absent for a dangling "+". */
  targetStepId?: string;
  /** Optional pre-generated id — pass one when the caller needs the id up front. */
  id?: string;
}

/**
 * Inserts a brand-new step after `afterStepId` on `portId`, returning the new array and the
 * new step's id. Two cases, now purely topological (no positions to place):
 *   - mid-edge (targetStepId set): the new step is spliced onto that edge — `afterStep`'s
 *     port now points at the new step, and the new step points at the old target.
 *   - dangling (no targetStep): the new step is simply appended after `afterStep`'s port,
 *     with no outgoing edge yet.
 * The layout engine repaints everything on the next render, so there's nothing to position.
 */
export function insertStep(steps: Step[], stepClient: StepClient, args: InsertStepArgs): { steps: Step[]; newId: string } {
  const { afterStepId, portId, stepType, targetStepId } = args;
  const newId = args.id ?? newStepId();
  const def = stepClient[stepType];
  const outputPort = def?.ports.outputs[0]?.id ?? "next";

  if (!steps.some((s) => s.id === afterStepId)) return { steps, newId };

  const newStep: Step = {
    id: newId,
    type: stepType,
    config: { ...(def?.defaultConfig ?? {}) },
    next: targetStepId ? [{ portId: outputPort, targetId: targetStepId }] : [],
  };

  const next = steps.map((s) =>
    s.id === afterStepId
      ? { ...s, next: [...s.next.filter((n) => n.portId !== portId), { portId, targetId: newId }] }
      : s
  );
  return { steps: [...next, newStep], newId };
}

/**
 * Removes a step. A step with exactly one outgoing edge is spliced out — its predecessors
 * reconnect straight to its successor, so deleting a middle step doesn't orphan everything
 * after it. A step with 0 outgoing edges (a dangling end or a Goal) has nothing to splice
 * to, so its incoming edges are simply dropped. A step with 2+ outputs (Branches) can't be
 * spliced unambiguously — which branch would the predecessor continue onto? — so its
 * incoming edges are dropped rather than guessed.
 */
export function removeStep(steps: Step[], stepId: string): Step[] {
  const removed = steps.find((s) => s.id === stepId);
  if (!removed) return steps;
  const spliceTargetId = removed.next.length === 1 ? removed.next[0].targetId : null;
  return redirectIncoming(steps, stepId, spliceTargetId).filter((s) => s.id !== stepId);
}

export interface ReorderTargetEdge {
  sourceStepId: string;
  portId: string;
  targetStepId: string;
}

/**
 * Splices an already-placed step into a different edge (drag-to-reorder). Only valid for a
 * step with exactly one outgoing edge (one obvious "next" to reconnect through) — the
 * caller's dragReorder.isReorderable already gates the drag the same way; this re-checks so
 * the transform can't silently do the wrong thing. Detaches the step (reconnect its
 * predecessors straight to its old successor), then attaches it into the target edge: the
 * edge's source now points at the step, and the step points at what that edge used to point
 * at. Positions are derived, so there's nothing to move — the layout engine repaints the
 * step into its new place on the next render.
 */
export function reorderStep(steps: Step[], stepId: string, edge: ReorderTargetEdge): Step[] {
  const moved = steps.find((s) => s.id === stepId);
  if (!moved || moved.next.length !== 1 || edge.sourceStepId === stepId || edge.targetStepId === stepId) {
    return steps;
  }
  const oldTargetId = moved.next[0].targetId;
  const oldPortId = moved.next[0].portId;

  const detached = redirectIncoming(steps, stepId, oldTargetId);

  return detached.map((s) => {
    if (s.id === edge.sourceStepId) {
      return {
        ...s,
        next: s.next.map((n) => (n.portId === edge.portId && n.targetId === edge.targetStepId ? { ...n, targetId: stepId } : n)),
      };
    }
    if (s.id === stepId) {
      return { ...s, next: [{ portId: oldPortId, targetId: edge.targetStepId }] };
    }
    return s;
  });
}

/**
 * Sets the workflow's Trigger event. On a brand-new workflow (empty steps[]) this creates
 * the Trigger step itself — the first thing ChooseTriggerPanel does. On an existing one
 * ("Change trigger") it swaps the event on steps[0] in place, keeping its id and next and
 * every downstream step, and resets event-specific fields rather than carrying stale ones
 * across an event change.
 */
export function setTriggerEvent(steps: Step[], event: string): Step[] {
  if (steps.length === 0) {
    return [{ id: newStepId(), type: "trigger", config: { event }, next: [] }];
  }
  return steps.map((s, i) => (i === 0 ? { ...s, config: { event } } : s));
}

/**
 * Points a Go to action step's single output edge at another step by id (its "Jump to"
 * field). Go to action has exactly one output port, so this always fully replaces that one
 * edge — never a merge with anything it already pointed at.
 */
export function setGoToTarget(steps: Step[], stepId: string, targetStepId: string): Step[] {
  return steps.map((s) => (s.id === stepId ? { ...s, next: [{ portId: "next", targetId: targetStepId }] } : s));
}
