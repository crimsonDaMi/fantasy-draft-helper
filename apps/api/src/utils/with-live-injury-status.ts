import { PlayerMatch } from "../domain/player-match.js";
import { Player } from "../domain/player.js";

/**
 * A stored ranking keeps the player snapshot from when it was imported,
 * so its injury status goes stale. Overlay the status from the live
 * player cache instead — and drop it when the cache doesn't know the
 * player (e.g. not loaded yet), rather than showing a stale one.
 */
export function withLiveInjuryStatus<T extends PlayerMatch>(
  match: T,
  getLivePlayer: (sleeperId: string) => Player | undefined,
): T {
  if (!match.player) {
    return match;
  }

  return {
    ...match,
    player: {
      ...match.player,
      injuryStatus: getLivePlayer(match.player.sleeperId)?.injuryStatus,
    },
  };
}
