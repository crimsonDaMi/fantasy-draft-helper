import {
  PlayerMatch,
} from "../domain/player-match.js";

export class RankingStoreService {
  private matches: PlayerMatch[] =
    [];

  setMatches(
    matches: PlayerMatch[],
  ): void {
    this.matches = matches;
  }

  getMatches(): PlayerMatch[] {
    return this.matches;
  }

  clear(): void {
    this.matches = [];
  }

  hasRankings(): boolean {
    return this.matches.length > 0;
  }
}