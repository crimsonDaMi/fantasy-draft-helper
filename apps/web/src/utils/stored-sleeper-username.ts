import { readStorage, writeStorage } from "./storage";

const STORAGE_KEY = "draft-helper-sleeper-username";

/** The last Sleeper username used to look up drafts, so it's prefilled
 * next time. */
export function readStoredSleeperUsername(): string {
  return readStorage(STORAGE_KEY) ?? "";
}

export function writeStoredSleeperUsername(username: string): void {
  writeStorage(STORAGE_KEY, username);
}
