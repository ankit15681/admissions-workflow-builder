import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { skipToken } from "@reduxjs/toolkit/query/react";
import { useGetWorkflowQuery, useSaveDraftMutation } from "../app/api";
import { useDebouncedCallback } from "./useDebouncedCallback";
import { useCanvasStore } from "../state/canvasStore";
import type { SaveStatus } from "../state/WorkflowEditContext";
import type { Step, Workflow } from "../types/workflow";

export interface WorkflowDraft {
  /** The fetched detail workflow (name/status/etc.), or undefined while loading. */
  workflow: Workflow | undefined;
  /** The local, editable working copy of the draft's steps[]. */
  steps: Step[];
  /** Apply a pure steps[] -> steps[] transform (from lib/workflowOps) as an undoable edit. */
  apply: (fn: (prev: Step[]) => Step[]) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: SaveStatus;
}

// The draft is a tiny undo/redo state machine: `steps` is the present, `past`/`future` are
// the history stacks. Modeling it as a reducer (rather than scattered useState) is what
// makes undo/redo correct-by-construction — every user edit is one `commit`, and hydration
// (load / conflict reconcile) resets history so you can't "undo" across a workflow switch.
interface DraftState {
  steps: Step[];
  past: Step[][];
  future: Step[][];
}
type DraftAction =
  | { type: "hydrate"; steps: Step[] }
  | { type: "commit"; fn: (prev: Step[]) => Step[] }
  | { type: "undo" }
  | { type: "redo" };

function draftReducer(state: DraftState, action: DraftAction): DraftState {
  switch (action.type) {
    case "hydrate":
      return { steps: action.steps, past: [], future: [] };
    case "commit": {
      const nextSteps = action.fn(state.steps);
      if (nextSteps === state.steps) return state; // no-op edit (e.g. an invalid reorder) — don't pollute history
      return { steps: nextSteps, past: [...state.past, state.steps], future: [] };
    }
    case "undo": {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return { steps: prev, past: state.past.slice(0, -1), future: [state.steps, ...state.future] };
    }
    case "redo": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return { steps: next, past: [...state.past, state.steps], future: state.future.slice(1) };
    }
    default:
      return state;
  }
}

/**
 * Owns one workflow draft's whole client lifecycle: fetch the detail, hydrate a local
 * working copy of steps[], keep an undo/redo history of edits, debounce-autosave changes
 * back, and reconcile the revision guard's 409 conflicts.
 */
export function useWorkflowDraft(workflowId: string | null): WorkflowDraft {
  const { data: workflow } = useGetWorkflowQuery(workflowId ?? skipToken);
  const [saveDraft] = useSaveDraftMutation();

  const [state, dispatch] = useReducer(draftReducer, { steps: [], past: [], future: [] });
  const { steps } = state;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const revisionRef = useRef(0);
  // Starts true so the very first render (steps === [], before any workflow has loaded)
  // does NOT schedule an autosave, and so hydration (load / conflict reconcile) doesn't
  // immediately save the state it just pulled from the server.
  const skipNextSaveRef = useRef(true);

  const { closePanel, openChooseTrigger } = useCanvasStore((s) => ({
    closePanel: s.closePanel,
    openChooseTrigger: s.openChooseTrigger,
  }));

  // Resync (and reset history) whenever we switch to a different workflow — keyed on
  // workflow.id, not every background refetch, so a refetch of the same workflow never
  // clobbers an in-progress edit. A brand-new workflow (steps: []) opens the trigger picker.
  useEffect(() => {
    if (workflow) {
      skipNextSaveRef.current = true;
      dispatch({ type: "hydrate", steps: workflow.draftSteps });
      revisionRef.current = workflow.draftRevision;
      if (workflow.draftSteps.length === 0) openChooseTrigger();
      else closePanel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow?.id]);

  const debouncedSave = useDebouncedCallback((nextSteps: Step[]) => {
    // A real workflow always has at least its Trigger step, so an empty array here can only
    // mean local state hasn't hydrated yet — never autosave it over a real draft.
    if (!workflowId || nextSteps.length === 0) return;
    setSaveStatus("saving");
    saveDraft({ id: workflowId, steps: nextSteps, expectedRevision: revisionRef.current })
      .unwrap()
      .then((updated) => {
        revisionRef.current = updated.draftRevision;
        setSaveStatus("saved");
      })
      .catch((err: unknown) => {
        const e = err as { status?: number; data?: { current?: { draftSteps: Step[]; draftRevision: number } } };
        const current = e.data?.current;
        if (e.status === 409 && current) {
          // Someone else's save landed first — reconcile onto the server's latest draft
          // (resetting history) rather than silently overwriting it (C.6.4's revision guard).
          skipNextSaveRef.current = true;
          dispatch({ type: "hydrate", steps: current.draftSteps });
          revisionRef.current = current.draftRevision;
          setSaveStatus("conflict");
        } else {
          setSaveStatus("error");
        }
      });
  }, 800);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    debouncedSave(steps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [steps]);

  const apply = useCallback((fn: (prev: Step[]) => Step[]) => dispatch({ type: "commit", fn }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);

  return {
    workflow,
    steps,
    apply,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    saveStatus,
  };
}
