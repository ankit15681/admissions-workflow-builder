import { useEffect, useRef } from "react";

/** Debounces a callback by `delayMs`, always calling the latest version passed in. */
// A generic callback constraint genuinely needs `any[]` here: `unknown[]` would reject
// callers whose callback takes specific argument types (function parameter contravariance).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useDebouncedCallback<T extends (...args: any[]) => void>(callback: T, delayMs: number) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (...args: Parameters<T>) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => callbackRef.current(...args), delayMs);
  };
}
