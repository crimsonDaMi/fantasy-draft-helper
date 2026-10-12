import { PlayerMatch } from "../domain/player-match.js";
import { Player } from "../domain/player.js";

/**
 * A stored ranking holds only a row's own data for its player (name,
 * position and team as ranked). Use the live player from the player
 * cache instead, with current name, team and injury status; when the
 * cache doesn't know the player (e.g. not loaded yet), keep the row's
 * data, without an injury status rather than a stale one.
 */
export function withLivePlayer<T extends PlayerMatch>(
  match: T,
  getLivePlayer: (sleeperId: string) => Player | undefined,
): T {
  if (!match.player) {
    return match;
  }

  return {
    ...match,
    player: getLivePlayer(match.player.sleeperId) ?? {
      ...match.player,
      injuryStatus: undefined,
    },
  };
}
