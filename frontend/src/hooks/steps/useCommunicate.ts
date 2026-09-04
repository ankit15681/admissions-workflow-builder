import { useRef } from "react";
import { useGetRecipientVariablesQuery } from "../../app/api";
import type { RecipientVariableDef } from "../../types/stepTypes";

const RECIPIENT_OPTIONS = [
  { value: "applicant", label: "Applicant" },
  { value: "guardian", label: "Parent / Guardian" },
  { value: "both", label: "Applicant and guardian" },
  { value: "staff", label: "Assigned staff member" },
];
const RECIPIENT_LABELS: Record<string, string> = Object.fromEntries(RECIPIENT_OPTIONS.map((o) => [o.value, o.label]));

// Data-logic hook for the Communicate editor. Owns the recipient-aware variable list, the
// message textarea ref, cursor-insertion, and the committed-field bindings — all frontend-only
// state except recipient/subject/message, which are the only keys written to config.
export function useCommunicate(
  config: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void
) {
  const { data: variableMap } = useGetRecipientVariablesQuery();
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const recipient = (config.recipient as string) ?? "applicant";
  const subject = (config.subject as string) ?? "";
  const message = (config.message as string) ?? "";
  const variables: RecipientVariableDef[] = variableMap?.[recipient] ?? [];

  const set = (patch: Record<string, unknown>) => onChange({ ...config, ...patch });

  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    const el = messageRef.current;
    if (!el) {
      set({ message: `${message}${token}` });
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    set({ message: message.slice(0, start) + token + message.slice(end) });
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  return {
    recipientOptions: RECIPIENT_OPTIONS,
    recipientLabel: RECIPIENT_LABELS[recipient],
    recipient,
    subject,
    message,
    messageRef,
    variables,
    setRecipient: (v: string) => set({ recipient: v }),
    setSubject: (v: string) => set({ subject: v }),
    setMessage: (v: string) => set({ message: v }),
    insertVariable,
  };
}
