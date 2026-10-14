import { Draft, DraftPick } from "./draft.js";

export interface DraftState {
  draft: Draft;
  picks: DraftPick[];
  draftedPlayerIds: Set<string>;
  lastUpdatedAt: Date;
}
