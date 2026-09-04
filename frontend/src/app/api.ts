import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type {
  StepTypeDefinition,
  ConditionTypeDefinition,
  RecipientVariablesMap,
  StepCategoryMeta,
} from "../types/stepTypes";
import type { Step, Workflow, WorkflowRun, RunDetail } from "../types/workflow";

// RTK Query owns all server state — step types, workflow draft, run history — per the
// design doc's C.6.5 ("Server state ... owned by React Query"), swapped for RTK Query
// per this build's stack choice. REST only, no WebSockets/SSE (spec item #7): anything
// that needs to feel live is polled via `pollingInterval`.
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  tagTypes: ["Workflow", "WorkflowList", "Runs"],
  endpoints: (builder) => ({
    getStepTypes: builder.query<StepTypeDefinition[], void>({
      query: () => "/step-types",
    }),
    getStepCategories: builder.query<StepCategoryMeta[], void>({
      query: () => "/step-categories",
    }),
    getConditionTypes: builder.query<ConditionTypeDefinition[], void>({
      query: () => "/condition-types",
    }),
    getRecipientVariables: builder.query<RecipientVariablesMap, void>({
      query: () => "/recipient-variables",
    }),

    listWorkflows: builder.query<Workflow[], void>({
      query: () => "/workflows",
      providesTags: ["WorkflowList"],
    }),
    getWorkflow: builder.query<Workflow, string>({
      query: (id) => `/workflows/${id}`,
      providesTags: (_result, _err, id) => [{ type: "Workflow", id }],
    }),
    createWorkflow: builder.mutation<Workflow, { name: string; description?: string }>({
      query: (body) => ({ url: "/workflows", method: "POST", body }),
      invalidatesTags: ["WorkflowList"],
    }),
    updateWorkflowName: builder.mutation<Workflow, { id: string; name: string }>({
      query: ({ id, name }) => ({ url: `/workflows/${id}`, method: "PATCH", body: { name } }),
      invalidatesTags: (_result, _err, arg) => [{ type: "Workflow", id: arg.id }, "WorkflowList"],
    }),
    deleteWorkflow: builder.mutation<void, string>({
      query: (id) => ({ url: `/workflows/${id}`, method: "DELETE" }),
      invalidatesTags: ["WorkflowList"],
    }),
    saveDraft: builder.mutation<Workflow, { id: string; steps: Step[]; expectedRevision: number }>({
      query: ({ id, steps, expectedRevision }) => ({
        url: `/workflows/${id}/draft`,
        method: "PATCH",
        body: { steps, expectedRevision },
      }),
      invalidatesTags: (_result, _err, arg) => [{ type: "Workflow", id: arg.id }],
    }),
    publishWorkflow: builder.mutation<Workflow, string>({
      query: (id) => ({ url: `/workflows/${id}/publish`, method: "POST" }),
      invalidatesTags: (_result, _err, id) => [{ type: "Workflow", id }, "WorkflowList"],
    }),
    unpublishWorkflow: builder.mutation<Workflow, string>({
      query: (id) => ({ url: `/workflows/${id}/unpublish`, method: "POST" }),
      invalidatesTags: (_result, _err, id) => [{ type: "Workflow", id }, "WorkflowList"],
    }),

    getRuns: builder.query<WorkflowRun[], string>({
      query: (workflowId) => `/workflows/${workflowId}/runs`,
      providesTags: ["Runs"],
    }),
    getRunDetail: builder.query<RunDetail, string>({
      query: (runId) => `/runs/${runId}/history`,
      providesTags: ["Runs"],
    }),
  }),
});

export const {
  useGetStepTypesQuery,
  useGetStepCategoriesQuery,
  useGetConditionTypesQuery,
  useGetRecipientVariablesQuery,
  useListWorkflowsQuery,
  useGetWorkflowQuery,
  useCreateWorkflowMutation,
  useUpdateWorkflowNameMutation,
  useDeleteWorkflowMutation,
  useSaveDraftMutation,
  usePublishWorkflowMutation,
  useUnpublishWorkflowMutation,
  useGetRunsQuery,
  useGetRunDetailQuery,
} = api;
