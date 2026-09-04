import {
  PlayerMatch,
} from "../domain/player-match.js";

import {
  RankingRepository,
} from "../repositories/ranking.repository.js";

export class RankingStoreService {
  private readonly repository:
    RankingRepository;

  constructor(
    repositoryOrPath:
      RankingRepository | string =
      new RankingRepository(),
  ) {
    this.repository =
      typeof repositoryOrPath === "string"
        ? new RankingRepository(
          repositoryOrPath,
        )
        : repositoryOrPath;
  }

  setMatches(
    matches: PlayerMatch[],
  ): string {
    return this.repository.create(
      matches,
    );
  }

  getMatches(
    rankingId?: string,
  ): PlayerMatch[] {
    const selectedRankingId =
      rankingId ??
      this.repository.getLatestRankingId();

    if (!selectedRankingId) {
      return [];
    }

    return this.repository.getMatches(
      selectedRankingId,
    );
  }

  hasRanking(
    rankingId: string,
  ): boolean {
    return this.repository.hasRanking(
      rankingId,
    );
  }

  clear(): void {
    this.repository.clear();
  }

  hasRankings(): boolean {
    return this.repository.hasRankings();
  }

  close(): void {
    this.repository.close();
  }
}