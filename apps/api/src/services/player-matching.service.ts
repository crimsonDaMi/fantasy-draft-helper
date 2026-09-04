import {
  Player,
} from "../domain/player.js";

import {
  PlayerMatch,
} from "../domain/player-match.js";

import {
  Ranking,
} from "../domain/ranking.js";

import {
  PlayerService,
} from "./player.service.js";

import {
  normalizePlayerName,
} from "../utils/normalize-player-name.js";

export class PlayerMatchingService {
  constructor(
    private readonly playerService:
      PlayerService,
  ) { }

  matchRanking(
    ranking: Ranking,
  ): PlayerMatch {
    const bySleeperId =
      this.matchBySleeperId(
        ranking,
      );

    if (bySleeperId) {
      return bySleeperId;
    }

    return this.matchByName(
      ranking,
    );
  }

  private matchBySleeperId(
    ranking: Ranking,
  ): PlayerMatch | undefined {
    if (!ranking.sleeperPlayerId) {
      return undefined;
    }

    const player =
      this.playerService.getPlayerById(
        ranking.sleeperPlayerId,
      );

    if (!player) {
      return undefined;
    }

    return {
      ranking,

      player,

      method: "SLEEPER_ID",

      warnings:
        this.getIdMatchWarnings(
          ranking,
          player,
        ),
    };
  }

  private matchByName(
    ranking: Ranking,
  ): PlayerMatch {
    const candidates =
      this.playerService.findPlayersByName(
        ranking.playerName,
      );

    if (
      candidates.length === 0
    ) {
      return {
        ranking,

        method: "NONE",
      };
    }

    const byTeamPosition =
      candidates.filter(
        (player) =>
          player.team ===
          ranking.team &&
          player.position ===
          ranking.position,
      );

    if (
      byTeamPosition.length === 1
    ) {
      return {
        ranking,

        player:
          byTeamPosition[0],

        method:
          "NAME_POSITION_TEAM",
      };
    }

    const byPosition =
      candidates.filter(
        (player) =>
          player.position ===
          ranking.position,
      );

    if (
      byPosition.length === 1
    ) {
      return {
        ranking,

        player:
          byPosition[0],

        method:
          "NAME_POSITION",
      };
    }

    const byTeam = candidates.filter(
      (player) =>
        ranking.team !== undefined &&
        player.team === ranking.team,
    );

    if (
      byTeam.length === 1
    ) {
      return {
        ranking,

        player:
          byTeam[0],

        method: "NAME_TEAM",
      };
    }

    if (
      candidates.length === 1
    ) {
      return {
        ranking,

        player:
          candidates[0],

        method: "NAME",
      };
    }

    return {
      ranking,

      method: "AMBIGUOUS",

      candidates,
    };
  }

  matchRankings(
    rankings: Ranking[],
  ): PlayerMatch[] {
    return rankings.map(
      (ranking) =>
        this.matchRanking(
          ranking,
        ),
    );
  }

  private getIdMatchWarnings(
    ranking: Ranking,

    player: Player,
  ) {
    const warnings: (
      | "ID_METADATA_MISMATCH"
    )[] = [];

    const namesMatch =
      normalizePlayerName(
        ranking.playerName,
      ) ===
      normalizePlayerName(
        player.fullName,
      );

    if (
      !namesMatch ||
      player.team !== ranking.team ||
      player.position !== ranking.position
    ) {
      warnings.push(
        "ID_METADATA_MISMATCH",
      );
    }

    return warnings.length > 0
      ? warnings
      : undefined;
  }
}