import { useState } from "react";

// Data-logic hook paired with the Select atom. Owns only ephemeral touched state and
// derives a required-error; the chosen value lives in the step config.
export function useSelectField(opts: { value: string; required?: boolean }) {
  const [touched, setTouched] = useState(false);
  const error = touched && opts.required && !opts.value ? "This field is required." : null;
  return { error, markTouched: () => setTouched(true) };
}
