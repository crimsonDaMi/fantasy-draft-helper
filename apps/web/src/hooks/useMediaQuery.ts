import { useCallback, useSyncExternalStore } from "react";

/** Phones. Keep in sync with the phone media query in index.css. */
export const PHONE_QUERY = "(max-width: 599px)";

/** Whether a CSS media query currently matches, updated live. Always
 * false where `matchMedia` is missing (jsdom in tests). */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== "function") {
        return () => {};
      }
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia(query).matches,
  );
}
