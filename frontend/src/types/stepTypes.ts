export type JSONSchema = Record<string, unknown>;

export interface StepPort {
  id: string;
  label?: string;
}

export interface StepPorts {
  outputs: StepPort[];
}

export type StepCategory = "flow" | "communication" | "application" | "staff" | "scheduling";

// Served by GET /api/step-categories — the palette's category labels + ordering, so the
// frontend no longer hardcodes them (modelled on Brevo's getCategoryData).
export interface StepCategoryMeta {
  key: StepCategory;
  label: string;
  order: number;
}

// Mirrors backend/src/stepTypes/types.ts `PublicStepTypeDefinition` exactly — this is
// the literal shape GET /api/step-types returns (C.6.1: "the frontend never needs its
// own copy of this metadata" beyond this type declaration).
export interface StepTypeDefinition {
  type: string;
  label: string;
  icon: string;
  color: string;
  category: StepCategory;
  description: string;
  /** Optional gating flag (Brevo's is_sales_restricted equivalent): when true the builder
   * hides this step type from the palette. */
  hidden?: boolean;
  /** Card-subtitle template with `{field}` tokens filled from config (see
   * summarizeStep/renderSummaryTemplate in lib/stepClient.ts). Absent on trigger/branches,
   * which are summarized specially. */
  summary?: string;
  /** Shown in place of `summary` when a referenced field is still empty. */
  summaryFallback?: string;
  configSchema: JSONSchema;
  defaultConfig: Record<string, unknown>;
  ports: StepPorts;
}

export interface ConditionTypeDefinition {
  type: string;
  label: string;
  description: string;
  configSchema: JSONSchema;
  defaultConfig: Record<string, unknown>;
}

export interface RecipientVariableDef {
  key: string;
  label: string;
}

export type RecipientVariablesMap = Record<string, RecipientVariableDef[]>;
