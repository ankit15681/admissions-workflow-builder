// Core shape every step type module implements. This registry is the single source of
// truth for both the Step Executor (server-side) and the frontend (via GET /api/step-types,
// which strips `execute` before sending it over the wire — see routes/stepTypes.ts).

export type StepCategory = "flow" | "communication" | "application" | "staff" | "scheduling";

export interface StepPort {
  id: string; // e.g. "next", "yes", "no"
  label?: string; // shown on the canvas edge/handle if present
}

export interface StepPorts {
  outputs: StepPort[];
}

// Plain JSON Schema (draft-07-ish subset) — intentionally not typed exhaustively here;
// both backend (ajv) and frontend (ajv) validate against the exact same object.
export type JSONSchema = Record<string, unknown>;

export interface ExecutionContext {
  runId: string;
  workflowId: string;
  applicationId: string;
  stepId: string;
  /** Number of times this exact step has executed within this run so far (before this execution). */
  priorExecutionCount: number;
  db: import("better-sqlite3").Database;
  now: () => string; // ISO timestamp, injected so it's mockable/consistent within one execution
}

export type ExecutionResult =
  | { outcome: "advance"; toPort?: string; detail?: string }
  | { outcome: "wait"; resumeAt: string; detail?: string }
  // runStatus defaults to "completed" — a Goal step reaching a normal end. Go to
  // action's hard iteration cap (spec item #8) uses "escalated" instead: hitting a
  // safety-net cap is an expected, labelled outcome that needs a human, not a bug.
  | { outcome: "end"; label: string; detail?: string; runStatus?: "completed" | "escalated" }
  | { outcome: "error"; detail: string };

export interface StepTypeDefinition {
  type: string;
  label: string;
  icon: string; // portable icon name — frontend maps this to a React component
  color: string; // portable color token — frontend maps this to a hex value
  category: StepCategory;
  description: string;
  /**
   * Optional gating flag — Brevo's `is_sales_restricted` equivalent. When true the builder
   * hides this step type from the palette (e.g. a plan-gated or not-yet-released action).
   * Part of the public projection, so gating is data-driven, not a frontend edit.
   */
  hidden?: boolean;
  /**
   * Template for the one-line summary shown under the title on a step's canvas card,
   * with `{field}` placeholders filled from the step's config (e.g. delay's
   * "Wait {amount} {unit}" -> "Wait 3 days"). The frontend substitutes generically —
   * an enum field is rendered via its enumLabels, an array field is comma-joined — so a
   * new step type gets a correct card summary from this string alone, with no per-type
   * code on the frontend. If any referenced field is empty, `summaryFallback` shows
   * instead. Omit both for a step type whose summary is genuinely config-shaped rather
   * than a flat template (trigger, branches) — those are the only two the frontend
   * summarizes specially; every other step type is driven entirely by this template.
   */
  summary?: string;
  /** Shown in place of `summary` when a field the template references is still empty. */
  summaryFallback?: string;
  configSchema: JSONSchema;
  defaultConfig: Record<string, unknown>;
  ports: StepPorts;
  /** Server-only. Stripped from the public projection sent to the frontend. */
  execute: (config: Record<string, unknown>, ctx: ExecutionContext) => Promise<ExecutionResult>;
}

// The subset of a StepTypeDefinition that is safe (and useful) to send to the client.
export type PublicStepTypeDefinition = Omit<StepTypeDefinition, "execute">;

export function toPublic(def: StepTypeDefinition): PublicStepTypeDefinition {
  const { execute, ...rest } = def;
  return rest;
}
