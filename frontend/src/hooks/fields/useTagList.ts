import { useState } from "react";

// Data-logic hook paired with the TagList atom. Owns the ephemeral "add" input text
// (frontend-only); the committed list of tags lives in the step config.
export function useTagList(opts: { value: string[]; onChange: (v: string[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    opts.onChange([...opts.value, trimmed]);
    setText("");
  };
  const removeAt = (index: number) => opts.onChange(opts.value.filter((_, i) => i !== index));
  return { text, setText, add, removeAt };
}
