import {
  Draft,
  DraftPick,
} from "./draft.js";
import { Player } from "./player.js";

export interface DraftState {
  draft: Draft;

  picks: DraftPick[];

  draftedPlayerIds: Set<string>;

  availablePlayers: Player[];

  lastUpdatedAt: Date;
}