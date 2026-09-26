import { Player } from "../domain/player.js";

import { FANTASY_POSITIONS } from "../domain/ranking.js";

const RELEVANT_POSITIONS = new Set<string>(FANTASY_POSITIONS);

export function hasRelevantFantasyPosition(player: Player): boolean {
  return player.fantasyPositions.some((position) =>
    RELEVANT_POSITIONS.has(position),
  );
}

export function isFantasyRelevantPlayer(player: Player): boolean {
  if (!player.active) {
    return false;
  }

  return hasRelevantFantasyPosition(player);
}
