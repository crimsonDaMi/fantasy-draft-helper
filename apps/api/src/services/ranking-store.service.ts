import { PlayerMatch } from "../domain/player-match.js";

import { RankingRepository } from "../repositories/ranking.repository.js";

export class RankingStoreService {
  constructor(private readonly repository: RankingRepository) {}

  /** Creates the user's ranking, replacing any previous one. */
  createRanking(matches: PlayerMatch[], userId: string, name?: string): string {
    return this.repository.create(matches, userId, name);
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

  clear(userId: string): void {
    this.repository.clear(userId);
  }

  hasRankings(userId: string): boolean {
    return this.repository.hasRankings(userId);
  }

  close(): void {
    this.repository.close();
  }
}
