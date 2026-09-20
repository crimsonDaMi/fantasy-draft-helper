import { FantasyPosition } from "../domain/ranking.js";

import { PlayerMatch } from "../domain/player-match.js";

import { RankingTier } from "../domain/ranking-tier.js";

import { RankingRepository } from "../repositories/ranking.repository.js";

import { HttpError } from "../utils/http-error.js";

import { PlayerService } from "./player.service.js";

export class RankingEditorService {
  constructor(
    private readonly repository: RankingRepository,

    private readonly playerService: PlayerService,
  ) {}

  async movePlayer(
    rankingId: string,
    userId: string,
    sleeperId: string,
    targetRank: number,
    targetTier: string,
  ): Promise<PlayerMatch[]> {
    this.assertOwnership(rankingId, userId);

    const existing = this.repository
      .getMatches(rankingId, userId)
      .some((match) => match.player?.sleeperId === sleeperId);

    let newMatch: PlayerMatch | undefined;

    if (!existing) {
      await this.playerService.ensurePlayersLoaded();
      const player = this.playerService.getPlayerById(sleeperId);

      if (!player) {
        throw new HttpError(404, "Player was not found");
      }

      newMatch = {
        ranking: {
          rank: targetRank,
          playerName: player.fullName,
          team: player.team,
          position: player.position as FantasyPosition | undefined,
          sleeperPlayerId: player.sleeperId,
          tier: targetTier,
        },
        player,
        method: "SLEEPER_ID",
      };
    }

    return this.repository.movePlayer(
      rankingId,
      sleeperId,
      targetRank,
      targetTier,
      newMatch,
    );
  }

  removePlayer(
    rankingId: string,
    userId: string,
    sleeperId: string,
  ): PlayerMatch[] {
    this.assertOwnership(rankingId, userId);

    return this.repository.removePlayer(rankingId, sleeperId);
  }

  insertTier(
    rankingId: string,
    userId: string,
    position: number,
  ): RankingTier[] {
    this.assertOwnership(rankingId, userId);

    return this.repository.insertTier(rankingId, position);
  }

  removeTier(
    rankingId: string,
    userId: string,
    position: number,
  ): RankingTier[] {
    this.assertOwnership(rankingId, userId);

    return this.repository.removeTier(rankingId, position);
  }

  private assertOwnership(rankingId: string, userId: string): void {
    if (!this.repository.hasRanking(rankingId, userId)) {
      throw new HttpError(404, "Ranking was not found");
    }
  }
}
