import {
  parse,
} from "csv-parse/sync";

import {
  Ranking,
  FantasyPosition,
} from "../domain/ranking.js";

import {
  RankingImportError,
  RankingImportResult,
} from "../domain/ranking-import.js";

const VALID_POSITIONS =
  new Set<FantasyPosition>([
    "QB",
    "RB",
    "WR",
    "TE",
    "K",
    "DEF",
  ]);

interface CsvRow {
  player_id?: string;

  Rank?: string;

  Name?: string;

  Team?: string;

  Position?: string;

  Tier?: string;
}

export class RankingCsvService {
  parse(
    csvContent: string,
  ): RankingImportResult {
    const rows =
      parse(csvContent, {
        columns: true,

        skip_empty_lines: true,

        trim: true,
      }) as CsvRow[];

    const rankings: Ranking[] =
      [];

    const errors: RankingImportError[] =
      [];

    rows.forEach(
      (row, index) => {
        const rowNumber = index + 2;

        const result =
          this.parseRow(
            row,
            rowNumber,
          );

        if (
          "error" in result
        ) {
          errors.push(
            result.error,
          );

          return;
        }

        rankings.push(
          result.ranking,
        );
      },
    );

    return {
      rankings,
      errors,
    };
  }

  private parseRow(
    row: CsvRow,

    rowNumber: number,
  ):
    | {
      ranking: Ranking;
    }
    | {
      error: RankingImportError;
    } {
    const rank =
      Number(row.Rank);

    if (
      !Number.isInteger(rank) ||
      rank < 1
    ) {
      return {
        error: {
          row: rowNumber,

          message:
            "Rank must be a positive integer",
        },
      };
    }

    if (!row.Name) {
      return {
        error: {
          row: rowNumber,

          message:
            "Name is required",
        },
      };
    }

    if (!row.Team) {
      return {
        error: {
          row: rowNumber,

          message:
            "Team is required",
        },
      };
    }

    const position =
      row.Position?.toUpperCase();

    if (
      !position ||
      !VALID_POSITIONS.has(
        position as FantasyPosition,
      )
    ) {
      return {
        error: {
          row: rowNumber,

          message:
            `Invalid position: ${row.Position}`,
        },
      };
    }

    return {
      ranking: {
        rank,

        playerName: row.Name,

        team: row.Team.toUpperCase(),

        position:
          position as FantasyPosition,

        sleeperPlayerId:
          row.player_id ||
          undefined,

        tier:
          row.Tier ||
          undefined,
      },
    };
  }
}