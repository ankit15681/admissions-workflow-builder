export interface StepNext {
  portId: string;
  targetId: string;
}

export interface Step {
  id: string;
  type: string;
  config: Record<string, unknown>;
  next: StepNext[];
  // No `position` — a workflow is a pure DAG and the canvas derives every node's position
  // from the graph shape on render (see lib/layoutGraph.ts). Positions are never stored.
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  status: "draft" | "published";
  draftRevision: number;
  draftSteps: Step[];
  publishedSteps: Step[] | null;
  publishedRevision: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  application_id: string;
  current_step_id: string | null;
  status: "running" | "waiting" | "completed" | "escalated" | "error";
  goal_label: string | null;
  due_at: string | null;
  started_at: string;
  ended_at: string | null;
  updated_at: string;
  applicant_name: string;
  programme: string;
}

export interface RunStepHistoryEntry {
  id: number;
  run_id: string;
  step_id: string;
  step_type: string;
  attempt: number;
  executed_at: string;
  result: string;
  detail: string | null;
}

export interface RunDetail {
  run: WorkflowRun;
  history: RunStepHistoryEntry[];
  documentRequests: unknown[];
  tasks: unknown[];
}
