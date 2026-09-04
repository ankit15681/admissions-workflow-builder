import {
  Zap,
  Clock,
  Split,
  Mail,
  CheckSquare,
  CornerUpLeft,
  Target,
  FileText,
  ClipboardCheck,
  Flag,
  Calendar,
  type LucideIcon,
} from "lucide-react";
import type { StepTypeDefinition } from "../types/stepTypes";

// The backend registry sends portable strings (icon name, color token) — never React
// components — so it never needs to know about the frontend's UI library (C.6.1). These
// two small local maps are the only place that translation happens.
const ICON_MAP: Record<string, LucideIcon> = {
  zap: Zap,
  clock: Clock,
  split: Split,
  mail: Mail,
  "check-square": CheckSquare,
  "corner-up-left": CornerUpLeft,
  target: Target,
  "file-text": FileText,
  "clipboard-check": ClipboardCheck,
  flag: Flag,
  calendar: Calendar,
};

export function iconFor(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Zap;
}

// The color palette itself lives in CSS (globals.css's --step-color-<token> vars), keyed
// by the same portable token the backend registry ships on each step type. This resolves
// a token straight to its var() — usable in any inline `style` — so there's no hex map to
// keep in sync here, and the slate fallback covers an unknown token.
export function colorFor(colorToken: string): string {
  return `var(--step-color-${colorToken}, var(--step-color-slate))`;
}

// A tiny lookup client built once from the fetched registry (C.6.1: "the frontend
// fetches /api/step-types once ... and builds a local step client from it").
export type StepClient = Record<string, StepTypeDefinition>;

export function buildStepClient(defs: StepTypeDefinition[] | undefined): StepClient {
  const client: StepClient = {};
  (defs ?? []).forEach((d) => {
    client[d.type] = d;
  });
  return client;
}

const TRIGGER_EVENT_TITLES: Record<string, string> = {
  form_submitted: "Form submitted",
  form_started: "Form started",
  status_changed: "Status changed",
};

/** The card's bold title line — mirrors the demo's pattern (e.g. "1. Form submitted",
 * "2. Send email"): the Trigger reflects its configured event, everything else uses its
 * step type's own short description. Purely presentational. */
export function titleFor(def: StepTypeDefinition | undefined, config: Record<string, unknown>): string {
  if (!def) return "";
  if (def.type === "trigger") return TRIGGER_EVENT_TITLES[String(config.event)] ?? "Trigger";
  return def.description.replace(/\.$/, "");
}

/** The short label for one trigger event value (e.g. "Status changed") — the same map
 * `titleFor` uses for a configured Trigger's card title, reused by ChooseTriggerPanel so
 * there's one place mapping event -> short label rather than two. */
export function triggerEventLabel(event: string): string {
  return TRIGGER_EVENT_TITLES[event] ?? event;
}

/**
 * The card subtitle for a step. Driven entirely by the step type's own `summary`
 * template from the backend registry (see `renderSummaryTemplate`), so adding a plain
 * new step type needs NO change here — you ship a "summary" string on the backend and
 * its card fills in automatically.
 *
 * The two exceptions below are the only step types whose summary is genuinely
 * config-*shaped* rather than a flat template, so a template string can't express them:
 *   - trigger: its whole summary structure depends on which `event` is selected.
 *   - branches: its label comes from the condition sub-registry, not its own fields.
 * These two — and only these two — get an explicit summarizer. Everything else falls
 * through to the generic template renderer, with no per-type knowledge anywhere here.
 * (This replaced a switch over every step type; that switch was the one place "add a
 * step" still meant editing generic frontend code.)
 */
export function summarizeStep(def: StepTypeDefinition | undefined, config: Record<string, unknown>): string {
  if (!def) return "";
  if (def.type === "trigger") return summarizeTrigger(def, config);
  if (def.type === "branches") return summarizeBranches(config);
  return renderSummaryTemplate(def, config);
}

/**
 * Fills a step type's `summary` template (e.g. "Wait {amount} {unit}") from its config.
 * Each `{field}` is substituted generically: an enum field renders via its `enumLabels`,
 * an array field is comma-joined, everything else is stringified. If any referenced
 * field is still empty, the step's `summaryFallback` shows instead. Knows nothing about
 * any specific step type — the template string is the whole contract.
 */
function renderSummaryTemplate(def: StepTypeDefinition, config: Record<string, unknown>): string {
  const template = def.summary;
  if (!template) return "";
  const keys = Array.from(template.matchAll(/\{(\w+)\}/g), (m) => m[1]);
  const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  if (keys.some((k) => isEmpty(config[k]))) return def.summaryFallback ?? "";
  return template.replace(/\{(\w+)\}/g, (_full, key) => formatSummaryValue(def, key, config[key]));
}

/** Renders one config value for a summary token — enum values become their label, arrays
 * comma-join. Reused by the Trigger summarizer for its form label, so the enum→label
 * resolution lives in exactly one place. */
function formatSummaryValue(def: StepTypeDefinition, key: string, raw: unknown): string {
  if (Array.isArray(raw)) return raw.join(", ");
  const props = def.configSchema?.properties as Record<string, { enum?: unknown[]; enumLabels?: unknown[] }> | undefined;
  const fieldSchema = props?.[key];
  if (fieldSchema?.enum && Array.isArray(fieldSchema.enumLabels)) {
    const idx = fieldSchema.enum.indexOf(raw);
    if (idx >= 0) return String(fieldSchema.enumLabels[idx] ?? raw);
  }
  return String(raw);
}

function summarizeTrigger(def: StepTypeDefinition, config: Record<string, unknown>): string {
  if (config.event === "status_changed") {
    return config.targetStatus ? `Status changes to "${String(config.targetStatus)}"` : "Status changes";
  }
  if (config.event === "form_submitted" || config.event === "form_started") {
    const props = def.configSchema?.properties as Record<string, { default?: unknown }> | undefined;
    const formValue = config.form ?? props?.form?.default ?? "any";
    const formLabel = formatSummaryValue(def, "form", formValue);
    return config.event === "form_started" ? `${formLabel} — started, not submitted` : formLabel;
  }
  return "";
}

function summarizeBranches(config: Record<string, unknown>): string {
  return config.conditionType ? `If ${String(config.conditionType).replace(/_/g, " ")}` : "Configure condition";
}
