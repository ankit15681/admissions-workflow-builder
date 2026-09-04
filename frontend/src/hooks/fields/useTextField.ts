import { useState } from "react";

// Data-logic hook paired with the TextField atom. It owns only *ephemeral* UI state
// (whether the field has been touched) and derives an error from that — the committed
// value itself lives in the step config, not here, so undo/redo and autosave stay intact.
export function useTextField(opts: { value: string; required?: boolean }) {
  const [touched, setTouched] = useState(false);
  const error = touched && opts.required && opts.value.trim() === "" ? "This field is required." : null;
  return { error, markTouched: () => setTouched(true) };
}
