import { PlayerMatch } from "../domain/player-match.js";
import { RankingImportResult } from "../domain/ranking-import.js";
import { PlayerMatchingService } from "./player-matching.service.js";
import { RankingCsvService } from "./ranking-csv.service.js";
import { RankingImportSummary } from "../domain/ranking-import-summary.js";
import { PlayerService } from "./player.service.js";
import { normalizeRankingTiers } from "../utils/normalize-ranking-tiers.js";

export interface ProcessedRankingImport {
  importResult: RankingImportResult;
  matches: PlayerMatch[];
  summary: RankingImportSummary;
}

/** A ranking holds each player once. A later row matched to a player an
 * earlier row already holds stays unmatched, with that player as its
 * only candidate, so the user sees it in the editor rather than losing it. */
function keepFirstOfEachPlayer(matches: PlayerMatch[]): PlayerMatch[] {
  const seen = new Set<string>();

  return matches.map((match) => {
    if (!match.player) {
      return match;
    }

    if (!seen.has(match.player.sleeperId)) {
      seen.add(match.player.sleeperId);
      return match;
    }

    return {
      ranking: match.ranking,
      method: "NONE",
      candidates: [match.player],
      warnings: [...(match.warnings ?? []), "DUPLICATE_PLAYER"],
    };
  });
}

export class RankingImportService {
  constructor(
    private readonly csvService: RankingCsvService,
    private readonly matchingService: PlayerMatchingService,
    private readonly playerService: PlayerService,
  ) {}

  async importCsv(csvContent: string): Promise<ProcessedRankingImport> {
    const parsedResult = this.csvService.parse(csvContent);

    const importResult = {
      ...parsedResult,
      rankings: normalizeRankingTiers(parsedResult.rankings),
    };

    await this.playerService.ensurePlayersLoaded();

    const matches = keepFirstOfEachPlayer(
      this.matchingService.matchRankings(importResult.rankings),
    );

    const summary = this.createSummary(importResult, matches);

    return {
      importResult,
      matches,
      summary,
    };
  }

  private createSummary(
    importResult: RankingImportResult,
    matches: PlayerMatch[],
  ): RankingImportSummary {
    const matched = matches.filter(
      (match) => match.player !== undefined,
    ).length;

    const unmatched = matches.filter((match) => match.method === "NONE").length;

    const ambiguous = matches.filter(
      (match) => match.method === "AMBIGUOUS",
    ).length;

    return {
      imported: importResult.rankings.length,
      matched,
      unmatched,
      ambiguous,
      errors: importResult.errors.length,
    };
  }
}
