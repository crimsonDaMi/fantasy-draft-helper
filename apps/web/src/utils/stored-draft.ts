import { readStoredJson, removeStorage, writeStorage } from "./storage";

const STORAGE_KEY = "draft-helper-draft";

export interface StoredDraft {
  draftId: string;
  /** Known when the draft was picked from a Sleeper user's draft list. */
  sleeperUserId?: string;
  /** Chosen by hand when the Sleeper user isn't known. */
  draftSlot?: number;
}

/** The monitored draft survives page reloads, so a refresh mid-draft
 * resumes monitoring instead of dropping back to setup. */
export function readStoredDraft(): StoredDraft | undefined {
  const stored = readStoredJson(STORAGE_KEY) as
    Partial<Record<keyof StoredDraft, unknown>> | null | undefined;

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
      typeof stored.draftSlot === "number" &&
      Number.isInteger(stored.draftSlot) &&
      stored.draftSlot > 0
        ? stored.draftSlot
        : undefined,
  };
}

export function writeStoredDraft(draft: StoredDraft): void {
  writeStorage(STORAGE_KEY, JSON.stringify(draft));
}

export function clearStoredDraft(): void {
  removeStorage(STORAGE_KEY);
}
