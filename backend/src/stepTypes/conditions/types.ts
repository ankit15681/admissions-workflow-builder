import type { JSONSchema } from "../types";

export interface ConditionEvalContext {
  applicationId: string;
  runId: string;
  stepId: string;
  db: import("better-sqlite3").Database;
  now: () => string;
}

// A condition type is itself a small self-contained module — the same
// "declare once, register, let generic UI read it" pattern as step types
// themselves (C.6.2 in the design doc). Adding a new condition later is an
// additive registration here, never a change to the Branches editor.
export interface ConditionTypeDefinition {
  type: string;
  label: string;
  description: string;
  configSchema: JSONSchema;
  defaultConfig: Record<string, unknown>;
  evaluate: (config: Record<string, unknown>, ctx: ConditionEvalContext) => Promise<boolean>;
}
