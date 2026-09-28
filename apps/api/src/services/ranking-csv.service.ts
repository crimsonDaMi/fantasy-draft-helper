import { parse } from "csv-parse/sync";

import {
  Ranking,
  FantasyPosition,
  FANTASY_POSITIONS,
} from "../domain/ranking.js";
import {
  RankingImportError,
  RankingImportResult,
} from "../domain/ranking-import.js";

const VALID_POSITIONS = new Set<FantasyPosition>(FANTASY_POSITIONS);

type CsvRow = Record<string, string | undefined>;

// Canonical and legacy headers, plus the column names of common ranking
// exports (FantasyPros: RK, TIERS, PLAYER NAME, TEAM, POS). Unknown
// columns are ignored.
const HEADER_ALIASES: Record<string, keyof NormalizedCsvRow> = {
  rank: "rank",
  rk: "rank",
  player: "player",
  name: "player",
  "player name": "player",
  position: "position",
  pos: "position",
  team: "team",
  tier: "tier",
  tiers: "tier",
  player_id: "sleeperPlayerId",
};

const DEFENSE_POSITIONS = new Set(["DEF", "DST", "D/ST"]);

/** Uppercases a position and accepts the "positional rank" form many
 * exports use (`RB12` → `RB`) and defense spellings (`DST` → `DEF`). */
function normalizePosition(value: string): string {
  const upper = value.toUpperCase();
  const withoutRank = upper.match(/^([A-Z/]+)\d+$/)?.[1] ?? upper;

  return DEFENSE_POSITIONS.has(withoutRank) ? "DEF" : withoutRank;
}

interface NormalizedCsvRow {
  rank?: string;
  player?: string;
  position?: string;
  team?: string;
  tier?: string;
  sleeperPlayerId?: string;
}

export class RankingCsvService {
  parse(csvContent: string): RankingImportResult {
    let rows: CsvRow[];

    try {
      rows = parse(csvContent, {
        bom: true,
        columns: true,
        skip_empty_lines: true,
        trim: true,
        skip_records_with_empty_values: false,
      }) as CsvRow[];
    } catch (error) {
      return {
        rankings: [],
        errors: [
          {
            row: 1,
            message:
              error instanceof Error
                ? `Invalid CSV: ${error.message}`
                : "Invalid CSV",
          },
        ],
      };
    }

    const rankings: Ranking[] = [];

    const errors: RankingImportError[] = [];

    if (rows.length === 0) {
      return {
        rankings,
        errors: [
          {
            row: 1,
            message: "CSV must contain a header and at least one ranking row",
          },
        ],
      };
    }

    const normalizedRows = rows.map((row) => this.normalizeRow(row));

    const firstRow = normalizedRows[0];

    if (firstRow?.rank === undefined || firstRow.player === undefined) {
      return {
        rankings,
        errors: [
          {
            row: 1,
            message: "CSV must include required columns: rank and player",
          },
        ],
      };
    }

    normalizedRows.forEach((row, index) => {
      const rowNumber = index + 2;

      const result = this.parseRow(row, rowNumber);

      if ("error" in result) {
        errors.push(result.error);

        return;
      }

      rankings.push(result.ranking);
    });

    return {
      rankings,
      errors,
    };
  }

  private parseRow(
    row: NormalizedCsvRow,
    rowNumber: number,
  ):
    | {
        ranking: Ranking;
      }
    | {
        error: RankingImportError;
      } {
    const rank = Number(row.rank);

    if (!Number.isInteger(rank) || rank < 1) {
      return {
        error: {
          row: rowNumber,
          message: "Rank must be a positive integer",
        },
      };
    }

    if (!row.player) {
      return {
        error: {
          row: rowNumber,
          message: "Name is required",
        },
      };
    }

    const position =
      row.position === undefined ? undefined : normalizePosition(row.position);

    if (
      position !== undefined &&
      !VALID_POSITIONS.has(position as FantasyPosition)
    ) {
      return {
        error: {
          row: rowNumber,
          message: `Invalid position: ${row.position}`,
        },
      };
    }

    return {
      ranking: {
        rank,
        playerName: row.player,
        team: row.team ? row.team.toUpperCase() : undefined,
        position: position as FantasyPosition | undefined,
        sleeperPlayerId: row.sleeperPlayerId || undefined,
        tier: row.tier || undefined,
      },
    };
  }

  private normalizeRow(row: CsvRow): NormalizedCsvRow {
    const normalized: NormalizedCsvRow = {};

    for (const [header, value] of Object.entries(row)) {
      const field = HEADER_ALIASES[header.trim().toLowerCase()];

      if (field !== undefined) {
        normalized[field] = value?.trim() || undefined;
      }
    }

    return normalized;
  }
}
