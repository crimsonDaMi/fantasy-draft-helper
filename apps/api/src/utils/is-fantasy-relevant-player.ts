import { Player } from "../domain/player.js";
import { FANTASY_POSITIONS } from "../domain/ranking.js";
import { DAY_MS } from "./time.js";

const RELEVANT_POSITIONS = new Set<string>(FANTASY_POSITIONS);

// Sleeper has news on every player in the league within a season; one
// without any for longer has left it, even if Sleeper still lists them
// as active.
const MAX_NEWS_AGE_MS = 365 * DAY_MS;

export function hasRelevantFantasyPosition(player: Player): boolean {
  return player.fantasyPositions.some((position) =>
    RELEVANT_POSITIONS.has(position),
  );
}

/** Whether the player plays this season. Sleeper's `active` flag alone
 * isn't enough: it stays set for many players who retired years ago.
 * Players with news in the past year count; without any news, only
 * players on a team do (team defenses, players just signed). */
function isCurrentPlayer(player: Player, now: number): boolean {
  if (!player.active) {
    return false;
  }

  if (player.lastNewsAt === undefined) {
    return player.team !== undefined;
  }

  return now - player.lastNewsAt <= MAX_NEWS_AGE_MS;
}

export function isFantasyRelevantPlayer(
  player: Player,
  now = Date.now(),
): boolean {
  return isCurrentPlayer(player, now) && hasRelevantFantasyPosition(player);
}
