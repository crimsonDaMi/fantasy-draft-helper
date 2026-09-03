import {
  Player,
} from "../domain/player.js";

export function isFantasyRelevantPlayer(
  player: Player,
): boolean {
  if (!player.active) {
    return false;
  }

  if (
    player.fantasyPositions.length === 0
  ) {
    return false;
  }

  return true;
}