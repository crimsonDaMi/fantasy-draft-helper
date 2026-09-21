import { FantasyPosition } from "../domain/ranking.js";

import { PlayerMatch } from "../domain/player-match.js";

import { Player } from "../domain/player.js";

import { RankingTier } from "../domain/ranking-tier.js";

import { RankingRepository } from "../repositories/ranking.repository.js";

import { HttpError } from "../utils/http-error.js";

import { isFantasyRelevantPlayer } from "../utils/is-fantasy-relevant-player.js";

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

  /**
   * Active, fantasy-relevant players not currently part of this ranking —
   * the pool shown in the editor's "unranked" side panel. Requirement #6
   * in docs/ranking-editor-requirements.md.
   */
  async getUnrankedPlayers(
    rankingId: string,
    userId: string,
  ): Promise<Player[]> {
    this.assertOwnership(rankingId, userId);

    await this.playerService.ensurePlayersLoaded();

    const rankedSleeperIds = new Set(
      this.repository
        .getMatches(rankingId, userId)
        .map((match) => match.player?.sleeperId)
        .filter((sleeperId): sleeperId is string => sleeperId !== undefined),
    );

    return this.playerService
      .getAllPlayers()
      .filter(
        (player) =>
          isFantasyRelevantPlayer(player) &&
          !rankedSleeperIds.has(player.sleeperId),
      );
  }

  /**
   * Full ranking detail (players in rank order plus the tier list) — the
   * entry state for the ranking editor. Reuses the same repository query
   * as the recommendation flow rather than a second, lighter path: see
   * discussion in DEVELOPMENT_PLAN.md's Phase 4 notes.
   */
  getRanking(
    rankingId: string,
    userId: string,
  ): { players: PlayerMatch[]; tiers: RankingTier[] } {
    this.assertOwnership(rankingId, userId);

    return {
      players: this.repository.getMatches(rankingId, userId),
      tiers: this.repository.getTiers(rankingId),
    };
  }

  private assertOwnership(rankingId: string, userId: string): void {
    if (!this.repository.hasRanking(rankingId, userId)) {
      throw new HttpError(404, "Ranking was not found");
    }
  }
}
