// Declarative composition types for step editors. A step editor is described as a map of
// field descriptors (key -> what kind of atom + its options); useStepForm binds that map to
// a step's config object, and projectConfig enforces the frontend/backend data boundary.

export type FieldKind = "text" | "textarea" | "select" | "number" | "tags" | "checkbox";

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldDescriptor {
  kind: FieldKind;
  label?: string;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  options?: FieldOption[]; // select
  min?: number; // number
  /**
   * When present and false for the current config, the field is hidden AND its value is
   * dropped from the persisted config — kept frontend-only until it's relevant again
   * (e.g. an interview's "room" only matters when mode === "in_person").
   */
  visibleWhen?: (config: Record<string, unknown>) => boolean;
}

export type StepUnitDef = Record<string, FieldDescriptor>;

// --- Descriptor DSL ---------------------------------------------------------------------
// Small factories that produce field descriptors. They double as the composition/"extends"
// mechanism (Brevo's `__base__type`): a factory is the base spec, and the object you pass
// overrides it — e.g. `number({ min: 15, label: "Duration", required: true })`. A reusable
// group is just a plain descriptor object spread into a def, so inheritance needs no special
// machinery beyond object spread.
type FieldOpts = Omit<FieldDescriptor, "kind">;
export const text = (o: FieldOpts = {}): FieldDescriptor => ({ kind: "text", ...o });
export const textarea = (o: FieldOpts = {}): FieldDescriptor => ({ kind: "textarea", ...o });
export const select = (o: FieldOpts = {}): FieldDescriptor => ({ kind: "select", ...o });
export const number = (o: FieldOpts = {}): FieldDescriptor => ({ kind: "number", ...o });
export const tags = (o: FieldOpts = {}): FieldDescriptor => ({ kind: "tags", ...o });
export const checkbox = (o: FieldOpts = {}): FieldDescriptor => ({ kind: "checkbox", ...o });

// --- Layout -----------------------------------------------------------------------------
// A step editor can group its (flat) fields into titled sections for presentation — the
// grouping never changes the persisted config, which stays flat and projected as before.
export interface EditorSection {
  title?: string;
  keys: string[];
}

/**
 * The data boundary. Projects the editor's working config down to only the
 * backend-meaningful keys before it is persisted:
 *   - keeps only keys declared in the step's field def (nothing extraneous leaks through),
 *   - drops any field currently hidden by visibleWhen,
 *   - omits undefined values.
 * This is what makes "only meaningful data goes to the backend" enforceable rather than
 * a convention: everything else stays in the editor's frontend-only state.
 */
export function projectConfig(config: Record<string, unknown>, def: StepUnitDef): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, descriptor] of Object.entries(def)) {
    const visible = descriptor.visibleWhen ? descriptor.visibleWhen(config) : true;
    if (!visible) continue;
    if (config[key] !== undefined) out[key] = config[key];
  }
  return out;
}

/**
 * Derives a field descriptor from one JSON Schema property node — the bridge that lets the
 * generic SchemaForm render through the same field registry the bespoke editors use, so
 * there's one field-rendering path in the whole app.
 */
export function schemaToDescriptor(key: string, raw: Record<string, unknown>, required: boolean): FieldDescriptor {
  const type = raw.type as string | undefined;
  const description = raw.description as string | undefined;
  const items = raw.items as { type?: string } | undefined;
  const enumValues = raw.enum as string[] | undefined;
  const enumLabels = raw.enumLabels as string[] | undefined;
  const label = humanizeKey(key);

  if (type === "array" && items?.type === "string") {
    return { kind: "tags", label, required, hint: description };
  }
  if (type === "boolean") {
    return { kind: "checkbox", label, hint: description };
  }
  if (enumValues) {
    return {
      kind: "select",
      label,
      required,
      hint: description,
      options: enumValues.map((v, i) => ({ value: v, label: enumLabels?.[i] ?? v })),
    };
  }
  if (type === "number") {
    return { kind: "number", label, required, hint: description, min: raw.minimum as number | undefined };
  }
  const long = key.toLowerCase().includes("message") || ((raw.maxLength as number | undefined) ?? 0) > 200;
  return { kind: long ? "textarea" : "text", label, required, hint: description, placeholder: description };
}

function humanizeKey(key: string): string {
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}
