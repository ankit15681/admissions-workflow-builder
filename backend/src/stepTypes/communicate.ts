import type { StepTypeDefinition } from "./types";
import { getApplication } from "../db/applications";
import { renderTemplate } from "./variables/recipientVariables";

// Stubbed email/SMS provider (per CLAUDE_CODE_PROMPT.md: "Stub these. Log ... rather
// than wiring a real provider"). Idempotency is guaranteed one layer up: the executor
// only calls execute() once per (run, step, attempt), enforced by the unique index on
// run_step_history, so a retried resume can never double-send.
function sendEmailStub(to: string, subject: string, body: string) {
  // eslint-disable-next-line no-console
  console.log(`[stub email] to=${to} subject="${subject}"\n${body}\n`);
}

export const communicateStepType: StepTypeDefinition = {
  type: "communicate",
  label: "Communicate",
  icon: "mail",
  color: "teal",
  category: "communication",
  description: "Send an email.",
  summary: "Email — {subject}",
  summaryFallback: "Configure message",
  configSchema: {
    type: "object",
    properties: {
      recipient: {
        type: "string",
        enum: ["applicant", "guardian", "both", "staff"],
        default: "applicant",
        enumLabels: ["Applicant", "Parent / Guardian", "Applicant and guardian", "Assigned staff member"],
      },
      subject: { type: "string", minLength: 1 },
      message: { type: "string", minLength: 1 },
    },
    required: ["recipient", "subject", "message"],
  },
  defaultConfig: { recipient: "applicant", subject: "", message: "" },
  ports: { outputs: [{ id: "next" }] },
  async execute(config, ctx) {
    const { recipient, subject = "", message = "" } = config as {
      recipient?: string;
      subject?: string;
      message?: string;
    };
    const app = getApplication(ctx.db, ctx.applicationId);
    if (!app) return { outcome: "error", detail: "Application not found" };

    const data: Record<string, string | undefined> = {
      applicant_name: app.applicant_name,
      guardian_name: app.guardian_name,
      programme: app.programme,
      deadline_date: undefined,
      portal_link: `https://admissions.example.org/portal/${app.id}`,
      staff_name: app.assigned_reviewer ?? undefined,
      application_id: app.id,
      application_status: app.status,
      fee_amount: app.fee_amount,
      task_due_date: undefined,
    };

    const renderedSubject = renderTemplate(subject, data);
    const renderedMessage = renderTemplate(message, data);

    const recipients: string[] = [];
    if (recipient === "applicant" || recipient === "both") recipients.push(`${app.applicant_name} <applicant>`);
    if (recipient === "guardian" || recipient === "both") recipients.push(`${app.guardian_name} <guardian>`);
    if (recipient === "staff") recipients.push(`${app.assigned_reviewer ?? "Admissions staff"} <staff>`);

    recipients.forEach((to) => sendEmailStub(to, renderedSubject, renderedMessage));

    return { outcome: "advance", detail: `Sent to ${recipients.join(", ")}: "${renderedSubject}"` };
  },
};
