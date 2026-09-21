import { PlayerMatch } from "../domain/player-match.js";

import { RankingRepository } from "../repositories/ranking.repository.js";

export class RankingStoreService {
  private readonly repository: RankingRepository;

  constructor(
    repositoryOrPath: RankingRepository | string = new RankingRepository(),
  ) {
    this.repository =
      typeof repositoryOrPath === "string"
        ? new RankingRepository(repositoryOrPath)
        : repositoryOrPath;
  }

  setMatches(matches: PlayerMatch[], userId: string): string {
    return this.repository.create(matches, userId);
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
