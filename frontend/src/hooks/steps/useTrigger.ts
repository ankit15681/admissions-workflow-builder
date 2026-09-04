import { useWorkflowEdit } from "../../state/WorkflowEditContext";

interface SelectOption {
  value: string;
  label: string;
}

// Data-logic hook for the Trigger editor. Reads the Trigger step type's own configSchema to
// decide which single field is relevant to the configured event, and returns a discriminated
// view the component renders. Only the relevant key (form or targetStatus) is written to config.
export type TriggerEditorView =
  | { kind: "form"; value: string; options: SelectOption[]; hint?: string; onChange: (v: string) => void }
  | { kind: "status"; value: string; hint: string; onChange: (v: string) => void }
  | { kind: "none" };

export function useTrigger(
  config: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void
): TriggerEditorView {
  const { stepClient } = useWorkflowEdit();
  const properties = stepClient.trigger?.configSchema?.properties as
    | Record<string, { enum?: string[]; enumLabels?: string[]; default?: string; description?: string }>
    | undefined;
  const formSchema = properties?.form;
  const event = config.event;

  if (event === "form_submitted" || event === "form_started") {
    const options = (formSchema?.enum ?? ["any"]).map((v, i) => ({ value: v, label: formSchema?.enumLabels?.[i] ?? v }));
    return {
      kind: "form",
      value: (config.form as string) ?? formSchema?.default ?? "any",
      options,
      hint: formSchema?.description,
      onChange: (v) => onChange({ ...config, form: v }),
    };
  }

  if (event === "status_changed") {
    return {
      kind: "status",
      value: (config.targetStatus as string) ?? "",
      hint: "The application status value that fires this trigger. Leave blank to match any status change.",
      onChange: (v) => onChange({ ...config, targetStatus: v }),
    };
  }

  return { kind: "none" };
}
