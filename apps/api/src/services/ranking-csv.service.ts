import { parse } from "csv-parse/sync";

import {
  MAX_NOTE_LENGTH,
  Ranking,
  isFantasyPosition,
} from "../domain/ranking.js";
import {
  RankingImportError,
  RankingImportResult,
} from "../domain/ranking-import.js";

type CsvRow = Record<string, string | undefined>;

// Canonical and legacy headers, plus the column names of common ranking
// exports (FantasyPros: RK, TIERS, PLAYER NAME, TEAM, POS, BYE WEEK).
// Unknown columns are ignored.
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
  bye: "bye",
  "bye week": "bye",
  notes: "note",
  note: "note",
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
  bye?: string;
  note?: string;
}

/** NFL regular seasons have 18 weeks. */
const MAX_BYE_WEEK = 18;

/** A bye week from 1 to 18; anything else (blank, "-" for free agents)
 * is no bye, since the column is informational only. */
function parseBye(value: string | undefined): number | undefined {
  const week = Number(value);

  return value && Number.isInteger(week) && week >= 1 && week <= MAX_BYE_WEEK
    ? week
    : undefined;
}

type ParsedRow = { ranking: Ranking } | { error: RankingImportError };

function rowError(row: number, message: string): ParsedRow {
  return { error: { row, message } };
}

/** A result for a problem with the file as a whole, reported on the
 * header row. */
function fileError(message: string): RankingImportResult {
  return { rankings: [], errors: [{ row: 1, message }] };
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
      return fileError(
        error instanceof Error
          ? `Invalid CSV: ${error.message}`
          : "Invalid CSV",
      );
    }

    if (rows.length === 0) {
      return fileError(
        "CSV must contain a header and at least one ranking row",
      );
    }

    const normalizedRows = rows.map((row) => this.normalizeRow(row));

    const firstRow = normalizedRows[0];

    if (firstRow?.rank === undefined || firstRow.player === undefined) {
      return fileError("CSV must include required columns: rank and player");
    }

    const rankings: Ranking[] = [];

    const errors: RankingImportError[] = [];

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

  private parseRow(row: NormalizedCsvRow, rowNumber: number): ParsedRow {
    const rank = Number(row.rank);

    if (!Number.isInteger(rank) || rank < 1) {
      return rowError(rowNumber, "Rank must be a positive integer");
    }

    if (!row.player) {
      return rowError(rowNumber, "Name is required");
    }

    const position =
      row.position === undefined ? undefined : normalizePosition(row.position);

    if (position !== undefined && !isFantasyPosition(position)) {
      return rowError(rowNumber, `Invalid position: ${row.position}`);
    }

    if (row.note !== undefined && row.note.length > MAX_NOTE_LENGTH) {
      return rowError(
        rowNumber,
        `Notes must be at most ${MAX_NOTE_LENGTH} characters`,
      );
    }

    return {
      ranking: {
        rank,
        playerName: row.player,
        team: row.team ? row.team.toUpperCase() : undefined,
        position,
        sleeperPlayerId: row.sleeperPlayerId || undefined,
        tier: row.tier || undefined,
        bye: parseBye(row.bye),
        note: row.note,
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
