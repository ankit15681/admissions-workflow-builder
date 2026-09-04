import { create } from "zustand";
import type { DragOverEdge } from "../lib/dragReorder";

// Canvas-local, ephemeral UI state only (C.6.5) — selection, which panel is open, the
// "insert after this step" target, drag-in-progress position. Never persisted or
// synced; the workflow's steps[] (server state, owned by RTK Query) is the only source
// of truth for the graph itself.

export type LeftTab = "brief" | "legend";

export type PanelMode =
  | { mode: "none" }
  | { mode: "editStep"; stepId: string }
  | { mode: "chooseAction"; insertAfterStepId: string; portId: string; targetStepId?: string }
  | { mode: "chooseTrigger" }
  | { mode: "runHistory" }
  | { mode: "validation" };

interface CanvasState {
  leftTab: LeftTab;
  setLeftTab: (tab: LeftTab) => void;

  panel: PanelMode;
  openEditStep: (stepId: string) => void;
  openChooseAction: (insertAfterStepId: string, portId: string, targetStepId?: string) => void;
  openChooseTrigger: () => void;
  openRunHistory: () => void;
  openValidation: () => void;
  closePanel: () => void;

  leftPanelVisible: boolean;
  toggleLeftPanel: () => void;

  // Which real step-to-step edge a currently-dragged, reorderable step is hovering
  // close enough to that dropping now would splice it in there — set continuously
  // during a drag by WorkflowCanvas's onNodeDrag (via lib/dragReorder's
  // findClosestEdge), read by StepEdge to render that one edge's drop indicator, and
  // read again on drop to actually perform the reorder. null whenever nothing is being
  // dragged, or the drag isn't currently close enough to any edge to light one up.
  dragOverEdge: DragOverEdge | null;
  setDragOverEdge: (edge: DragOverEdge | null) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  leftTab: "brief",
  setLeftTab: (tab) => set({ leftTab: tab }),

  panel: { mode: "none" },
  openEditStep: (stepId) => set({ panel: { mode: "editStep", stepId } }),
  openChooseAction: (insertAfterStepId, portId, targetStepId) =>
    set({ panel: { mode: "chooseAction", insertAfterStepId, portId, targetStepId } }),
  openChooseTrigger: () => set({ panel: { mode: "chooseTrigger" } }),
  openRunHistory: () => set({ panel: { mode: "runHistory" } }),
  openValidation: () => set({ panel: { mode: "validation" } }),
  closePanel: () => set({ panel: { mode: "none" } }),

  leftPanelVisible: true,
  toggleLeftPanel: () => set((s) => ({ leftPanelVisible: !s.leftPanelVisible })),

  dragOverEdge: null,
  setDragOverEdge: (edge) => set({ dragOverEdge: edge }),
}));
