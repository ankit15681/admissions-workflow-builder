import { projectConfig, type FieldDescriptor, type StepUnitDef, type EditorSection } from "../lib/stepForm";

export interface BoundField {
  key: string;
  descriptor: FieldDescriptor;
  value: unknown;
  onChange: (v: unknown) => void;
}

/**
 * Binds a declarative step field-def to a step's config + onChange. A step editor becomes a
 * *composition* of atoms: this hook returns one bound field per visible descriptor, ready to
 * hand to <FieldRenderer>. Every change is routed through projectConfig, so the object that
 * reaches the reducer/backend contains only backend-meaningful keys — the editor never
 * persists frontend-only state. steps[] stays the single source of truth for committed values.
 */
export function useStepForm(
  config: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void,
  def: StepUnitDef
): { fields: BoundField[]; byKey: Record<string, BoundField> } {
  const setField = (key: string, value: unknown) => {
    onChange(projectConfig({ ...config, [key]: value }, def));
  };

  const fields: BoundField[] = Object.entries(def)
    .filter(([, descriptor]) => (descriptor.visibleWhen ? descriptor.visibleWhen(config) : true))
    .map(([key, descriptor]) => ({
      key,
      descriptor,
      value: config[key],
      onChange: (v: unknown) => setField(key, v),
    }));

  // Keyed lookup for section-based layouts (only visible fields are present, so a field
  // hidden by visibleWhen simply drops out of its section).
  const byKey: Record<string, BoundField> = {};
  for (const f of fields) byKey[f.key] = f;

  return { fields, byKey };
}

export interface FormSection {
  title?: string;
  fields: BoundField[];
}

/**
 * useStepForm + a section layout, resolved to render-ready sections. This is the engine that
 * a declarative-composed step editor's own hook wraps (see hooks/steps/*): the editor's hook
 * owns the field def + layout, this turns them into `{ sections }`, and the editor component
 * just renders them. With no layout it returns one untitled section containing every field.
 */
export function useSectionedForm(
  config: Record<string, unknown>,
  onChange: (next: Record<string, unknown>) => void,
  def: StepUnitDef,
  layout?: EditorSection[]
): { sections: FormSection[] } {
  const { fields, byKey } = useStepForm(config, onChange, def);
  if (!layout) return { sections: [{ fields }] };
  const sections = layout.map((s) => ({
    title: s.title,
    fields: s.keys.map((k) => byKey[k]).filter((f): f is BoundField => Boolean(f)),
  }));
  return { sections };
}
