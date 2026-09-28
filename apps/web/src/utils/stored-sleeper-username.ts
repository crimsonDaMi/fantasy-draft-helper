const STORAGE_KEY = "draft-helper-sleeper-username";

/** The last Sleeper username used to look up drafts, so it's prefilled
 * next time. Guarded like the other stored values. */
export function readStoredSleeperUsername(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeStoredSleeperUsername(username: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, username);
  } catch {
    // Not remembered; nothing else depends on it.
  }
}
