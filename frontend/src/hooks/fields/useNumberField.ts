import { useState } from "react";

// Data-logic hook paired with the NumberField atom. This is where a field kind's real
// parsing/validation logic lives: it turns the raw input string into `number | undefined`
// and derives required/min errors. Ephemeral touched state is local; the committed number
// lives in the step config.
export function useNumberField(opts: { value: number | undefined; required?: boolean; min?: number }) {
  const [touched, setTouched] = useState(false);
  const error = !touched
    ? null
    : opts.required && opts.value === undefined
      ? "This field is required."
      : opts.min !== undefined && opts.value !== undefined && opts.value < opts.min
        ? `Must be at least ${opts.min}.`
        : null;

  const parse = (raw: string): number | undefined => (raw === "" ? undefined : Number(raw));
  return { error, markTouched: () => setTouched(true), parse };
}
