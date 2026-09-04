import { useEffect, useState } from "react";
import {
  useListWorkflowsQuery,
  useCreateWorkflowMutation,
  useUpdateWorkflowNameMutation,
  useDeleteWorkflowMutation,
  usePublishWorkflowMutation,
  useUnpublishWorkflowMutation,
} from "../app/api";
import type { Workflow } from "../types/workflow";

export interface WorkflowSelection {
  workflows: Workflow[] | undefined;
  currentWorkflowId: string | null;
  setCurrentWorkflowId: (id: string | null) => void;
  createWorkflow: (name: string) => Promise<void>;
  renameWorkflow: (name: string) => Promise<void>;
  deleteCurrentWorkflow: () => Promise<void>;
  publish: () => Promise<void>;
  unpublish: () => Promise<void>;
  isPublishing: boolean;
  isUnpublishing: boolean;
}

/**
 * Owns the workflow-list concern: which workflow is selected, and the CRUD around the set
 * (create, rename, delete, publish/unpublish). Selection is picked *explicitly* on create
 * and delete rather than by reacting to the list refetch — the invalidated list lands a
 * beat after the mutation, so a membership-reacting effect would briefly snap selection to
 * the wrong workflow. The one initial-load effect below only fires when nothing is selected
 * yet, for exactly that reason.
 */
export function useWorkflowSelection(): WorkflowSelection {
  const { data: workflows } = useListWorkflowsQuery();
  const [currentWorkflowId, setCurrentWorkflowId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentWorkflowId && workflows && workflows.length > 0) {
      setCurrentWorkflowId(workflows[0].id);
    }
  }, [workflows, currentWorkflowId]);

  const [createWorkflowMut] = useCreateWorkflowMutation();
  const [updateWorkflowName] = useUpdateWorkflowNameMutation();
  const [deleteWorkflowMut] = useDeleteWorkflowMutation();
  const [publishWorkflow, { isLoading: isPublishing }] = usePublishWorkflowMutation();
  const [unpublishWorkflow, { isLoading: isUnpublishing }] = useUnpublishWorkflowMutation();

  async function createWorkflow(name: string) {
    const wf = await createWorkflowMut({ name }).unwrap();
    setCurrentWorkflowId(wf.id);
  }

  async function renameWorkflow(name: string) {
    if (currentWorkflowId) await updateWorkflowName({ id: currentWorkflowId, name }).unwrap();
  }

  async function deleteCurrentWorkflow() {
    if (!currentWorkflowId) return;
    // Pick the next selection from the list we already hold, rather than waiting on the
    // post-delete refetch and an effect to react to it (see the effect's comment above).
    const remaining = (workflows ?? []).filter((wf) => wf.id !== currentWorkflowId);
    await deleteWorkflowMut(currentWorkflowId).unwrap();
    setCurrentWorkflowId(remaining.length > 0 ? remaining[0].id : null);
  }

  async function publish() {
    if (currentWorkflowId) await publishWorkflow(currentWorkflowId).unwrap();
  }

  async function unpublish() {
    // The Trigger Listener only fires runs for published workflows, so this actually stops
    // a live workflow from running — not just a status label change.
    if (currentWorkflowId) await unpublishWorkflow(currentWorkflowId).unwrap();
  }

  return {
    workflows,
    currentWorkflowId,
    setCurrentWorkflowId,
    createWorkflow,
    renameWorkflow,
    deleteCurrentWorkflow,
    publish,
    unpublish,
    isPublishing,
    isUnpublishing,
  };
}
