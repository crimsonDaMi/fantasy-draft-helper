import { Draft } from "./draft.js";
import { Player } from "./player.js";

export interface DraftState {
  draft: Draft;

  draftedPlayerIds: Set<string>;

  availablePlayers: Player[];

  lastUpdatedAt: Date;
}