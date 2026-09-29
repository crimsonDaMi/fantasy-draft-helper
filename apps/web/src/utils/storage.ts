/**
 * localStorage access that never throws. Storage can be unavailable
 * (private mode, blocked site data), so a failed read means "nothing
 * stored" and a failed write means the value just isn't remembered.
 */
export function readStorage(key: string): string | undefined {
  try {
    return window.localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

/** A stored JSON value, or `undefined` if missing or unparsable. Callers
 * validate the shape. */
export function readStoredJson(key: string): unknown {
  const raw = readStorage(key);

  if (raw === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not remembered.
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to remove.
  }
}
