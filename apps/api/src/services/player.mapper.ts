import { Player } from "../domain/player.js";

import { SleeperPlayer } from "../types/sleeper.js";

export function mapSleeperPlayer(
  player: SleeperPlayer,
): Player {
  return {
    sleeperId: player.player_id,

    fullName:
      player.full_name ??
      buildFullName(
        player.first_name,
        player.last_name,
      ),

    firstName: player.first_name,

    lastName: player.last_name,

    position:
      player.position ?? undefined,

    team:
      player.team ?? undefined,

    status:
      player.status ?? undefined,

    active:
      player.active ?? false,

    fantasyPositions:
      player.fantasy_positions ?? [],
  };
}

function buildFullName(
  firstName?: string,
  lastName?: string,
): string {
  return [
    firstName,
    lastName,
  ]
    .filter(Boolean)
    .join(" ");
}