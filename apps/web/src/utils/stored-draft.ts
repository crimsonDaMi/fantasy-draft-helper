const STORAGE_KEY = "draft-helper-draft";

export interface StoredDraft {
  draftId: string;
  /** Known when the draft was picked from a Sleeper user's draft list. */
  sleeperUserId?: string;
  /** Chosen by hand when the Sleeper user isn't known. */
  draftSlot?: number;
}

/** The monitored draft survives page reloads, so a refresh mid-draft
 * resumes monitoring instead of dropping back to setup. Storage can be
 * unavailable (private mode, blocked site data), so every access is
 * guarded and a failure just means "nothing stored". */
export function readStoredDraft(): StoredDraft | undefined {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null",
    );
    if (typeof stored?.draftId !== "string" || stored.draftId === "") {
      return undefined;
    }

    return {
      draftId: stored.draftId,
      sleeperUserId:
        typeof stored.sleeperUserId === "string"
          ? stored.sleeperUserId
          : undefined,
      draftSlot:
        Number.isInteger(stored.draftSlot) && stored.draftSlot > 0
          ? stored.draftSlot
          : undefined,
    };
  } catch {
    return undefined;
  }
}

export function writeStoredDraft(draft: StoredDraft): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Not persisted; monitoring still works for this page load.
  }
}

export function clearStoredDraft(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
