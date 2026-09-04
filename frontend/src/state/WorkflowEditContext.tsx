import React, { createContext, useContext } from "react";
import type { Step } from "../types/workflow";
import type { StepClient } from "../lib/stepClient";
import type { ValidationIssue } from "../lib/validateWorkflow";

export type SaveStatus = "idle" | "saving" | "saved" | "conflict" | "error";

export interface WorkflowEditContextValue {
  steps: Step[];
  stepClient: StepClient;
  saveStatus: SaveStatus;
  /** Live workflow-integrity issues for the current draft (see lib/validateWorkflow). Drives
   * the per-step canvas badges, the issues panel, and the publish gate from one computation. */
  issues: ValidationIssue[];
  updateStepConfig: (stepId: string, config: Record<string, unknown>) => void;
  insertStep: (afterStepId: string, portId: string, stepType: string, targetStepId?: string) => string;
  removeStep: (stepId: string) => void;
  /** Creates the workflow's Trigger step (steps[0]) with the chosen event — only called
   * from ChooseTriggerPanel, on a brand-new workflow whose steps[] is still empty. */
  setTriggerEvent: (event: string) => void;
  /** Points a Go to action step's single output edge at another step by id — only called
   * from GoToActionEditor's "Jump to" field. Every other step type gets its next[] set
   * purely by canvas insertion (insertStep); Go to action is the one step whose entire
   * purpose is jumping somewhere else, so it needs an explicit way to (re)target it that
   * doesn't depend on having been dropped mid-edge onto an existing loop-back. */
  setGoToTarget: (stepId: string, targetStepId: string) => void;
  /** Splices an existing, already-on-the-canvas step into a different edge — dragging a
   * step and dropping it close enough to another edge (lib/dragReorder's
   * findClosestEdge, surfaced live via canvasStore's dragOverEdge while the drag is in
   * progress) reorders it into that spot instead of just repositioning it. Only called
   * from WorkflowCanvas's onNodeDragStop, and only for a step dragReorder.isReorderable
   * has already approved (exactly one outgoing edge) — every other step type keeps the
   * plain free-drag reposition behavior only. */
  reorderStep: (stepId: string, edge: { sourceStepId: string; portId: string; targetStepId: string }) => void;
}

const WorkflowEditContext = createContext<WorkflowEditContextValue | null>(null);

export function WorkflowEditProvider({ value, children }: { value: WorkflowEditContextValue; children: React.ReactNode }) {
  return <WorkflowEditContext.Provider value={value}>{children}</WorkflowEditContext.Provider>;
}

export function useWorkflowEdit(): WorkflowEditContextValue {
  const ctx = useContext(WorkflowEditContext);
  if (!ctx) throw new Error("useWorkflowEdit must be used within WorkflowEditProvider");
  return ctx;
}
