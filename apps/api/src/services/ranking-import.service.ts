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

export interface ProcessedRankingImport {
  importResult: RankingImportResult;

  matches: PlayerMatch[];
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

    return {
      importResult,

      matches,
    };
  }
}