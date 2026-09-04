import { useMemo } from "react";
import Ajv from "ajv";
import type { JSONSchema } from "../../types/stepTypes";
import { FieldRenderer } from "../../lib/fieldRegistry";
import { schemaToDescriptor } from "../../lib/stepForm";
import "./editor.css";

const ajv = new Ajv({ allErrors: true, strict: false });

interface SchemaFormProps {
  schema: JSONSchema;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}

/**
 * Renders an editor directly from a fetched JSON Schema (C.6.1) — used for every step type
 * that doesn't register a bespoke editor. It no longer knows how to draw any specific input:
 * it derives a field descriptor per schema property (schemaToDescriptor) and delegates
 * rendering to the shared field registry via <FieldRenderer>, so generic and bespoke editors
 * go through the exact same atoms. Still validated client-side with ajv against the same
 * schema object the backend re-validates with, so the two can never drift.
 */
export function SchemaForm({ schema, value, onChange }: SchemaFormProps) {
  const validate = useMemo(() => ajv.compile(schema), [schema]);
  const valid = validate(value);
  const errorsByField: Record<string, string> = {};
  if (!valid && validate.errors) {
    validate.errors.forEach((err) => {
      const field = (err.instancePath || err.params?.missingProperty ? `/${err.params?.missingProperty}` : err.instancePath).replace(
        /^\//,
        ""
      );
      if (field) errorsByField[field] = err.message ?? "Invalid value";
    });
  }

  const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
  const required = (schema.required ?? []) as string[];

  return (
    <div className="schema-form">
      {Object.entries(properties).map(([key, propSchema]) => (
        <FieldRenderer
          key={key}
          descriptor={schemaToDescriptor(key, propSchema, required.includes(key))}
          value={value[key]}
          onChange={(v) => onChange({ ...value, [key]: v })}
          error={errorsByField[key]}
        />
      ))}
    </div>
  );
}
