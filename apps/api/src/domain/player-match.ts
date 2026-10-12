import { Player } from "./player.js";
import { Ranking } from "./ranking.js";

type PlayerMatchMethod =
  | "SLEEPER_ID"
  | "NAME_POSITION_TEAM"
  | "NAME_POSITION"
  | "NAME_TEAM"
  | "NAME"
  /** A team defense found by its team abbreviation, which is its Sleeper ID. */
  | "TEAM_DEFENSE"
  | "NONE"
  | "AMBIGUOUS"
  /** Chosen by the user in the ranking editor for an unmatched row. */
  | "MANUAL";

type PlayerMatchWarning =
  | "ID_METADATA_MISMATCH"
  /** An earlier row already holds this player; a ranking holds each
   * player once, so this row stays unmatched with the player as its
   * only candidate. */
  | "DUPLICATE_PLAYER";

export interface PlayerMatch {
  ranking: Ranking;
  player?: Player;
  method: PlayerMatchMethod;
  candidates?: Player[];
  warnings?: PlayerMatchWarning[];
}
