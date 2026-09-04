import {
  Player,
} from "./player.js";

import {
  Ranking,
} from "./ranking.js";

export type PlayerMatchMethod =
  | "SLEEPER_ID"
  | "NAME_POSITION_TEAM"
  | "NAME_POSITION"
  | "NAME_TEAM"
  | "NAME"
  | "NONE"
  | "AMBIGUOUS";

export type PlayerMatchWarning =
  | "ID_METADATA_MISMATCH";

export interface PlayerMatch {
  ranking: Ranking;

  player?: Player;

  method: PlayerMatchMethod;

  candidates?: Player[];

  warnings?: PlayerMatchWarning[];
}