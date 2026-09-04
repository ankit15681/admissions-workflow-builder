// Data-driven map (C.4, C.6.2): adding a recipient or a variable is a data change
// here, never a change to the Communicate editor or a switch statement in code.
// The frontend fetches this alongside the communicate step type definition
// (see routes/stepTypes.ts) so its variable picker only ever offers variables
// valid for whoever is selected.

export interface RecipientVariableDef {
  key: string; // used as {{key}}
  label: string;
}

export const RECIPIENT_VARIABLES: Record<string, RecipientVariableDef[]> = {
  applicant: [
    { key: "applicant_name", label: "Applicant name" },
    { key: "programme", label: "Programme" },
    { key: "deadline_date", label: "Deadline date" },
    { key: "portal_link", label: "Portal link" },
  ],
  guardian: [
    { key: "guardian_name", label: "Guardian name" },
    { key: "applicant_name", label: "Applicant name" },
    { key: "programme", label: "Programme" },
    { key: "deadline_date", label: "Deadline date" },
    { key: "portal_link", label: "Portal link" },
  ],
  both: [
    { key: "guardian_name", label: "Guardian name" },
    { key: "applicant_name", label: "Applicant name" },
    { key: "programme", label: "Programme" },
    { key: "deadline_date", label: "Deadline date" },
    { key: "portal_link", label: "Portal link" },
  ],
  staff: [
    { key: "staff_name", label: "Staff name" },
    { key: "applicant_name", label: "Applicant name" },
    { key: "application_id", label: "Application ID" },
    { key: "application_status", label: "Application status" },
    { key: "task_due_date", label: "Task due date" },
  ],
};

// Resolve {{variable}} tokens against a data snapshot at send time.
export function renderTemplate(template: string, data: Record<string, string | undefined>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key) => {
    return data[key] !== undefined ? String(data[key]) : `{{${key}}}`;
  });
}
