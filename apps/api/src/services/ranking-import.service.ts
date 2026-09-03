import {
  PlayerMatch,
} from "../domain/player-match.js";

import {
  RankingImportResult,
} from "../domain/ranking-import.js";

import {
  PlayerMatchingService,
} from "./player-matching.service.js";

import {
  RankingCsvService,
} from "./ranking-csv.service.js";

import {
  RankingImportSummary,
} from "../domain/ranking-import-summary.js";

export interface ProcessedRankingImport {
  importResult: RankingImportResult;

  matches: PlayerMatch[];

  summary: RankingImportSummary;
}

export class RankingImportService {
  constructor(
    private readonly csvService:
      RankingCsvService,

    private readonly matchingService:
      PlayerMatchingService,
  ) { }

  importCsv(
    csvContent: string,
  ): ProcessedRankingImport {
    const importResult =
      this.csvService.parse(
        csvContent,
      );

    const matches =
      this.matchingService
        .matchRankings(
          importResult.rankings,
        );

    const summary =
      this.createSummary(
        importResult,
        matches,
      );

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
    const matched =
      matches.filter(
        (match) =>
          match.player !== undefined,
      ).length;

    const unmatched =
      matches.filter(
        (match) =>
          match.method === "NONE",
      ).length;

    const ambiguous =
      matches.filter(
        (match) =>
          match.method === "AMBIGUOUS",
      ).length;

    return {
      imported:
        importResult.rankings.length,

      matched,

      unmatched,

      ambiguous,

      errors:
        importResult.errors.length,
    };
  }
}