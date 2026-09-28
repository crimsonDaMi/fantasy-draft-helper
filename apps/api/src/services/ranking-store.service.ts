import { PlayerFlag } from "../domain/player-flag.js";
import { PlayerMatch } from "../domain/player-match.js";
import {
  RankingRepository,
  RankingSummary,
} from "../repositories/ranking.repository.js";

export class RankingStoreService {
  constructor(private readonly repository: RankingRepository) {}

  /** Adds a ranking to the user's saved rankings. */
  createRanking(matches: PlayerMatch[], userId: string, name?: string): string {
    return this.repository.create(matches, userId, name);
  }

  listRankings(userId: string): RankingSummary[] {
    return this.repository.listRankings(userId);
  }

  renameRanking(rankingId: string, userId: string, name: string): void {
    this.repository.rename(rankingId, userId, name);
  }

  deleteRanking(rankingId: string, userId: string): void {
    this.repository.delete(rankingId, userId);
  }

  getFlags(rankingId: string): Record<string, PlayerFlag> {
    return this.repository.getFlags(rankingId);
  }

  getLatestRankingId(userId: string): string | undefined {
    return this.repository.getLatestRankingId(userId);
  }

  getMatches(userId: string, rankingId?: string): PlayerMatch[] {
    const selectedRankingId =
      rankingId ?? this.repository.getLatestRankingId(userId);

    if (!selectedRankingId) {
      return [];
    }

    return this.repository.getMatches(selectedRankingId, userId);
  }

  hasRanking(rankingId: string, userId: string): boolean {
    return this.repository.hasRanking(rankingId, userId);
  }

  hasRankings(userId: string): boolean {
    return this.repository.hasRankings(userId);
  }

  close(): void {
    this.repository.close();
  }
}
