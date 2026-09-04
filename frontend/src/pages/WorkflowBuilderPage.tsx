import React, { useEffect, useMemo, useState } from "react";
import { useGetStepTypesQuery } from "../app/api";
import { buildStepClient } from "../lib/stepClient";
import * as ops from "../lib/workflowOps";
import { validateWorkflow } from "../lib/validateWorkflow";
import { useWorkflowSelection } from "../hooks/useWorkflowSelection";
import { useWorkflowDraft } from "../hooks/useWorkflowDraft";
import { useCanvasStore } from "../state/canvasStore";
import { WorkflowEditProvider, type WorkflowEditContextValue } from "../state/WorkflowEditContext";
import { TopBar } from "../components/TopBar";
import { NameWorkflowModal } from "../components/NameWorkflowModal";
import { ConfirmModal } from "../components/ConfirmModal";
import { LeftPanel } from "../components/LeftPanel/LeftPanel";
import { WorkflowCanvas } from "../components/Canvas/WorkflowCanvas";
import { StepEditorPanel } from "../components/Editor/StepEditorPanel";
import { ChooseActionPanel } from "../components/Editor/ChooseActionPanel";
import { ChooseTriggerPanel } from "../components/Editor/ChooseTriggerPanel";
import { ValidationPanel } from "../components/Editor/ValidationPanel";
import { RunHistoryPanel } from "../components/RunHistory/RunHistoryPanel";

type NameModalState = { mode: "create" } | { mode: "rename" } | null;

export function WorkflowBuilderPage() {
  const { data: stepTypes } = useGetStepTypesQuery();
  const stepClient = useMemo(() => buildStepClient(stepTypes), [stepTypes]);

  const selection = useWorkflowSelection();
  const draft = useWorkflowDraft(selection.currentWorkflowId);
  const { steps, apply, undo, redo, canUndo, canRedo, saveStatus } = draft;
  const workflow = draft.workflow;

  const [nameModal, setNameModal] = useState<NameModalState>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const { panel, leftPanelVisible, openValidation } = useCanvasStore((s) => ({
    panel: s.panel,
    leftPanelVisible: s.leftPanelVisible,
    openValidation: s.openValidation,
  }));

  // Keyboard undo/redo. Ignored while typing in a field so it never fights text editing in
  // the step editor; Cmd/Ctrl+Z undoes, add Shift (or Ctrl+Y) to redo.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  // Live workflow-integrity issues, recomputed whenever the graph changes. One computation
  // drives the canvas badges, the issues panel, and the publish gate.
  const issues = useMemo(() => validateWorkflow(steps, stepClient), [steps, stepClient]);
  const errorCount = issues.filter((i) => i.level === "error").length;

  // Every canvas edit is a pure steps[] transform from lib/workflowOps, applied to the
  // draft. This object is the only place the two are wired together — the transforms stay
  // pure and testable, the draft hook owns persistence, and this stays glue.
  const editValue: WorkflowEditContextValue = {
    steps,
    stepClient,
    saveStatus,
    issues,
    updateStepConfig: (id, config) => apply((prev) => ops.updateStepConfig(prev, id, config)),
    insertStep: (afterStepId, portId, stepType, targetStepId) => {
      const id = ops.newStepId();
      apply((prev) => ops.insertStep(prev, stepClient, { afterStepId, portId, stepType, targetStepId, id }).steps);
      return id;
    },
    removeStep: (id) => apply((prev) => ops.removeStep(prev, id)),
    reorderStep: (id, edge) => apply((prev) => ops.reorderStep(prev, id, edge)),
    setTriggerEvent: (event) => apply((prev) => ops.setTriggerEvent(prev, event)),
    setGoToTarget: (id, targetId) => apply((prev) => ops.setGoToTarget(prev, id, targetId)),
  };

  async function submitNameModal(name: string) {
    if (nameModal?.mode === "create") await selection.createWorkflow(name);
    else if (nameModal?.mode === "rename") await selection.renameWorkflow(name);
    setNameModal(null);
  }

  async function confirmDeleteWorkflow() {
    await selection.deleteCurrentWorkflow();
    setDeleteConfirmOpen(false);
  }

  // Publish is gated on validation: with any errors, open the issues panel instead of
  // publishing a broken workflow. Warnings don't block.
  async function handlePublish() {
    if (errorCount > 0) {
      openValidation();
      return;
    }
    await selection.publish();
  }

  if (!stepTypes || !selection.workflows) {
    return <div style={{ padding: 40, color: "var(--color-text-faint)" }}>Loading workflow builder…</div>;
  }

  // Deleting the last workflow leaves nothing to select — show an explicit empty state
  // (with its own entry point) instead of a perpetual loading message. Checked before
  // `!workflow` so a valid selection whose detail is still fetching gets "Loading…", not a
  // one-frame flash of this.
  if (selection.workflows.length === 0) {
    return (
      <div className="app-shell">
        <div className="builder-empty">
          <div className="builder-empty__title">No workflows yet</div>
          <div className="builder-empty__hint">Create one to get started.</div>
          <button className="btn btn--primary" onClick={() => setNameModal({ mode: "create" })}>
            New workflow
          </button>
        </div>
        {nameModal && (
          <NameWorkflowModal
            title="Name your workflow"
            submitLabel="Create"
            onSubmit={submitNameModal}
            onCancel={() => setNameModal(null)}
          />
        )}
      </div>
    );
  }

  if (!workflow) {
    return <div style={{ padding: 40, color: "var(--color-text-faint)" }}>Loading workflow builder…</div>;
  }

  return (
    <WorkflowEditProvider value={editValue}>
      <div className="app-shell">
        <TopBar
          workflows={selection.workflows}
          currentWorkflow={workflow}
          onSelectWorkflow={selection.setCurrentWorkflowId}
          onCreateWorkflow={() => setNameModal({ mode: "create" })}
          onRenameWorkflow={() => setNameModal({ mode: "rename" })}
          onDeleteWorkflow={() => setDeleteConfirmOpen(true)}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onPublish={handlePublish}
          onUnpublish={selection.unpublish}
          saveStatus={saveStatus}
          isPublishing={selection.isPublishing}
          isUnpublishing={selection.isUnpublishing}
          errorCount={errorCount}
          warningCount={issues.length - errorCount}
          onShowIssues={openValidation}
        />
        {nameModal && (
          <NameWorkflowModal
            title={nameModal.mode === "create" ? "Name your workflow" : "Rename workflow"}
            submitLabel={nameModal.mode === "create" ? "Create" : "Save"}
            initialName={nameModal.mode === "rename" ? workflow.name : ""}
            onSubmit={submitNameModal}
            onCancel={() => setNameModal(null)}
          />
        )}
        {deleteConfirmOpen && (
          <ConfirmModal
            title="Delete workflow"
            message={`Delete "${workflow.name}"? This can't be undone — any runs, tasks, and history tied to it will be deleted too.`}
            confirmLabel="Delete"
            danger
            onConfirm={confirmDeleteWorkflow}
            onCancel={() => setDeleteConfirmOpen(false)}
          />
        )}
        <div className="builder-body">
          {leftPanelVisible && <LeftPanel workflowName={workflow.name} workflowDescription={workflow.description} />}
          {panel.mode === "editStep" && <StepEditorPanel stepId={panel.stepId} />}
          {panel.mode === "chooseAction" && (
            <ChooseActionPanel insertAfterStepId={panel.insertAfterStepId} portId={panel.portId} targetStepId={panel.targetStepId} />
          )}
          {panel.mode === "chooseTrigger" && <ChooseTriggerPanel />}
          {panel.mode === "runHistory" && <RunHistoryPanel workflowId={workflow.id} />}
          {panel.mode === "validation" && <ValidationPanel />}
          <WorkflowCanvas />
        </div>
      </div>
    </WorkflowEditProvider>
  );
}
