import { useEffect, useState } from "react";

/** The value, updated only after it has stopped changing for `delayMs`
 * — so typing in a search box triggers one request, not one per key. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);

  return debounced;
}
