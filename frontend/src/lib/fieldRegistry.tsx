import type { FC } from "react";
import { TextField } from "../components/fields/TextField";
import { Select } from "../components/fields/Select";
import { NumberField } from "../components/fields/NumberField";
import { TagList } from "../components/fields/TagList";
import { Checkbox } from "../components/fields/Checkbox";
import type { FieldDescriptor, FieldKind } from "./stepForm";

// The field registry — the design-system counterpart to the step-type registry, one level
// down. It maps a field *kind* to the atom that renders it. Adding a new field kind is one
// atom + one hook + one line here (and one FieldKind union member), exactly mirroring how
// adding a step type works. FieldRenderer is the single generic renderer editors use.

export interface FieldControlProps {
  descriptor: FieldDescriptor;
  value: unknown;
  onChange: (v: unknown) => void;
  /** Optional externally-supplied error (e.g. from SchemaForm's ajv validation). */
  error?: string | null;
}

const registry: Record<FieldKind, FC<FieldControlProps>> = {
  text: ({ descriptor, value, onChange, error }) => (
    <TextField
      label={descriptor.label}
      placeholder={descriptor.placeholder}
      hint={descriptor.hint}
      required={descriptor.required}
      error={error}
      value={(value as string) ?? ""}
      onChange={(v) => onChange(v)}
    />
  ),
  textarea: ({ descriptor, value, onChange, error }) => (
    <TextField
      textarea
      label={descriptor.label}
      placeholder={descriptor.placeholder}
      hint={descriptor.hint}
      required={descriptor.required}
      error={error}
      value={(value as string) ?? ""}
      onChange={(v) => onChange(v)}
    />
  ),
  select: ({ descriptor, value, onChange, error }) => (
    <Select
      label={descriptor.label}
      hint={descriptor.hint}
      required={descriptor.required}
      error={error}
      options={descriptor.options ?? []}
      value={(value as string) ?? ""}
      onChange={(v) => onChange(v)}
    />
  ),
  number: ({ descriptor, value, onChange, error }) => (
    <NumberField
      label={descriptor.label}
      hint={descriptor.hint}
      required={descriptor.required}
      error={error}
      min={descriptor.min}
      value={value as number | undefined}
      onChange={(v) => onChange(v)}
    />
  ),
  tags: ({ descriptor, value, onChange, error }) => (
    <TagList
      label={descriptor.label}
      hint={descriptor.hint}
      required={descriptor.required}
      error={error}
      value={(value as string[]) ?? []}
      onChange={(v) => onChange(v)}
    />
  ),
  checkbox: ({ descriptor, value, onChange }) => (
    <Checkbox
      label={descriptor.label}
      hint={descriptor.hint}
      value={value === true}
      onChange={(v) => onChange(v)}
    />
  ),
};

export function FieldRenderer({ descriptor, value, onChange, error }: FieldControlProps) {
  const Control = registry[descriptor.kind];
  if (!Control) return null;
  return <Control descriptor={descriptor} value={value} onChange={onChange} error={error} />;
}
