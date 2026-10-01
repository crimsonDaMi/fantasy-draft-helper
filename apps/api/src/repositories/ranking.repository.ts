import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { applySchema, openDatabase } from "./database.js";
import { PlayerFlag } from "../domain/player-flag.js";
import { PlayerMatch } from "../domain/player-match.js";
import { RankingTier } from "../domain/ranking-tier.js";
import { ConflictError, NotFoundError } from "../utils/domain-errors.js";
import {
  labelTierToNumeric,
  MAX_TIERS,
  numericTierToLabel,
} from "../utils/tier.js";

interface RankingPlayerRow {
  rank: number;
  tier: string | null;
  match_json: string;
}

/** Keeps a user's storage bounded; each ranking holds a few hundred rows. */
export const MAX_RANKINGS_PER_USER = 20;

export interface RankingSummary {
  id: string;
  name: string;
  createdAt: string;
  playerCount: number;
  matchedCount: number;
}

/** Index in `ordered` of the `matchedRank`-th (1-based) matched row, or
 * the end of the list when there are fewer matched rows. */
function indexOfMatchedRank(
  ordered: PlayerMatch[],
  matchedRank: number,
): number {
  let seen = 0;

  for (const [index, match] of ordered.entries()) {
    if (match.player && ++seen === Math.max(1, matchedRank)) {
      return index;
    }
  }

  return ordered.length;
}

/** `preferred` if it sorts between the tiers of the nearest matched rows
 * around `index`, else the tier of the matched row above (or below). */
function fittingTier(
  ordered: PlayerMatch[],
  index: number,
  preferred: string | undefined,
): string | undefined {
  const above = ordered
    .slice(0, index)
    .reverse()
    .find((match) => match.player)?.ranking.tier;
  const below = ordered.slice(index + 1).find((match) => match.player)
    ?.ranking.tier;
  const order = (tier: string | undefined) =>
    tier === undefined ? undefined : labelTierToNumeric(tier);
  const preferredOrder = order(preferred);

  if (
    preferredOrder !== undefined &&
    preferredOrder >= (order(above) ?? 0) &&
    preferredOrder <= (order(below) ?? Infinity)
  ) {
    return preferred;
  }

  return above ?? below ?? preferred;
}

interface TierPositionRow {
  position: number;
}

/**
 * `rank` and `tier` live only in their columns; `match_json` holds the rest
 * of the match. Rows written before that split still carry rank/tier in
 * their JSON too, so the columns always win.
 */
function parseMatchRows(rows: RankingPlayerRow[]): PlayerMatch[] {
  return rows.map((row) => {
    const match = JSON.parse(row.match_json) as PlayerMatch;

    return {
      ...match,
      ranking: {
        ...match.ranking,
        rank: row.rank,
        tier: row.tier ?? undefined,
      },
    };
  });
}

// ranking_players.name/position/team/match_status are denormalized copies
// of what match_json holds. Nothing reads them; they keep the table
// readable when inspecting the database with sqlite3. Dropping them is a
// schema change (major release), so they stay.
const RANKING_SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS rankings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ranking_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ranking_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    name TEXT NOT NULL,
    position TEXT,
    team TEXT,
    tier TEXT,
    sleeper_id TEXT,
    match_status TEXT NOT NULL,
    match_json TEXT NOT NULL,
    FOREIGN KEY (ranking_id) REFERENCES rankings(id)
      ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS ranking_players_ranking_id_rank
    ON ranking_players (ranking_id, rank, id);

  CREATE INDEX IF NOT EXISTS rankings_user_id_created_at
    ON rankings (user_id, created_at);

  CREATE TABLE IF NOT EXISTS ranking_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ranking_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    FOREIGN KEY (ranking_id) REFERENCES rankings(id)
      ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS ranking_tiers_ranking_id_position
    ON ranking_tiers (ranking_id, position);

  -- Added after v1.1.0. A new table (not a column on ranking_players) so
  -- existing databases pick it up without a reset, and so flags survive
  -- replaceAllPlayers, which rewrites every ranking_players row on each
  -- editor move.
  CREATE TABLE IF NOT EXISTS ranking_player_flags (
    ranking_id TEXT NOT NULL,
    sleeper_id TEXT NOT NULL,
    flag TEXT NOT NULL CHECK (flag IN ('watch', 'avoid')),
    PRIMARY KEY (ranking_id, sleeper_id),
    FOREIGN KEY (ranking_id) REFERENCES rankings(id)
      ON DELETE CASCADE
  );
`;

export class RankingRepository {
  private readonly database: DatabaseSync;

  constructor(databasePath?: string) {
    this.database = openDatabase(databasePath);

    applySchema(this.database, RANKING_SCHEMA);
  }

  create(
    matches: PlayerMatch[],
    userId: string,
    name = "Imported ranking",
  ): string {
    const rankingId = randomUUID();
    const createdAt = new Date().toISOString();

    this.transaction(() => {
      // Users keep several rankings side by side (e.g. one per league);
      // importing or starting a new one adds to them.
      const { count } = this.database
        .prepare(`SELECT COUNT(*) AS count FROM rankings WHERE user_id = ?`)
        .get(userId) as unknown as { count: number };

      if (count >= MAX_RANKINGS_PER_USER) {
        throw new ConflictError(
          `You can keep at most ${MAX_RANKINGS_PER_USER} rankings — delete one first`,
          "RANKING_LIMIT_REACHED",
        );
      }

      this.database
        .prepare(
          `INSERT INTO rankings (id, user_id, name, created_at)
         VALUES (?, ?, ?, ?)`,
        )
        .run(rankingId, userId, name, createdAt);

      this.insertPlayerRows(rankingId, matches);
      this.seedTiersFromMatches(rankingId, matches);
    });

    return rankingId;
  }

  getMatches(rankingId: string, userId: string): PlayerMatch[] {
    const rows = this.database
      .prepare(
        `SELECT ranking_players.rank AS rank,
                ranking_players.tier AS tier,
                ranking_players.match_json AS match_json
         FROM ranking_players
         JOIN rankings ON rankings.id = ranking_players.ranking_id
         WHERE ranking_players.ranking_id = ? AND rankings.user_id = ?
         ORDER BY ranking_players.rank ASC, ranking_players.id ASC`,
      )
      .all(rankingId, userId) as unknown as RankingPlayerRow[];

    return parseMatchRows(rows);
  }

  hasRanking(rankingId: string, userId: string): boolean {
    const row = this.database
      .prepare(
        `SELECT 1 AS found
         FROM rankings
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
      )
      .get(rankingId, userId) as unknown as { found: number } | undefined;

    return row !== undefined;
  }

  getLatestRankingId(userId: string): string | undefined {
    const row = this.database
      .prepare(
        `SELECT id
         FROM rankings
         WHERE user_id = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT 1`,
      )
      .get(userId) as unknown as { id: string } | undefined;

    return row?.id;
  }

  hasRankings(userId: string): boolean {
    return this.getLatestRankingId(userId) !== undefined;
  }

  /** The user's rankings, newest first. */
  listRankings(userId: string): RankingSummary[] {
    return this.database
      .prepare(
        `SELECT rankings.id AS id,
                rankings.name AS name,
                rankings.created_at AS createdAt,
                COUNT(ranking_players.id) AS playerCount,
                COUNT(ranking_players.sleeper_id) AS matchedCount
         FROM rankings
         LEFT JOIN ranking_players ON ranking_players.ranking_id = rankings.id
         WHERE rankings.user_id = ?
         GROUP BY rankings.id
         ORDER BY rankings.created_at DESC, rankings.rowid DESC`,
      )
      .all(userId) as unknown as RankingSummary[];
  }

  rename(rankingId: string, userId: string, name: string): void {
    const result = this.database
      .prepare(`UPDATE rankings SET name = ? WHERE id = ? AND user_id = ?`)
      .run(name, rankingId, userId);

    if (result.changes === 0) {
      throw new NotFoundError("Ranking was not found", "RANKING_NOT_FOUND");
    }
  }

  /** Deletes a ranking with its players, tiers, and flags (FK cascade). */
  delete(rankingId: string, userId: string): void {
    const result = this.database
      .prepare(`DELETE FROM rankings WHERE id = ? AND user_id = ?`)
      .run(rankingId, userId);

    if (result.changes === 0) {
      throw new NotFoundError("Ranking was not found", "RANKING_NOT_FOUND");
    }
  }

  /** Deletes all of a user's rankings with their players, tiers, and
   * flags (FK cascade), for account deletion. */
  deleteAllForUser(userId: string): void {
    this.database.prepare(`DELETE FROM rankings WHERE user_id = ?`).run(userId);
  }

  close(): void {
    this.database.close();
  }

  // ---------------------------------------------------------------------
  // Ranking editor mutations
  // ---------------------------------------------------------------------

  /**
   * Moves a player to `targetRank` (1-based) with `targetTier`. If the
   * player is not already part of the ranking, `newMatch` supplies the
   * ranking/player pair to insert instead. The whole list is renumbered
   * 1..N afterwards so rank stays a strict sequence.
   *
   * `targetRank` counts matched players only, as the editor shows them:
   * unmatched rows aren't in the editor's tiers, so they keep their place
   * between their neighbors instead of shifting the target position.
   */
  movePlayer(
    rankingId: string,
    sleeperId: string,
    targetRank: number,
    targetTier: string,
    newMatch?: PlayerMatch,
  ): PlayerMatch[] {
    this.transaction(() => {
      const ordered = this.getOrderedMatches(rankingId);

      const currentIndex = ordered.findIndex(
        (match) => match.player?.sleeperId === sleeperId,
      );

      let entry: PlayerMatch;

      if (currentIndex !== -1) {
        [entry] = ordered.splice(currentIndex, 1);
      } else {
        if (!newMatch) {
          throw new NotFoundError(
            "Player is not part of this ranking",
            "PLAYER_NOT_RANKED",
          );
        }
        entry = newMatch;
      }

      entry = {
        ...entry,
        ranking: { ...entry.ranking, tier: targetTier },
      };

      ordered.splice(indexOfMatchedRank(ordered, targetRank), 0, entry);

      this.replaceAllPlayers(rankingId, ordered);
    });

    return this.getOrderedMatches(rankingId);
  }

  /**
   * Replaces the unmatched row at `rank` (1-based, counting every row)
   * with `resolved` at the same position, or removes it when `resolved`
   * is undefined. The row keeps its tier unless edits since the import
   * left it between players of other tiers; it then joins the tier of
   * the matched player above it, so every tier stays one contiguous block.
   */
  replaceUnmatchedRow(
    rankingId: string,
    rank: number,
    resolved: PlayerMatch | undefined,
  ): PlayerMatch[] {
    this.transaction(() => {
      const ordered = this.getOrderedMatches(rankingId);
      const row = ordered[rank - 1];

      if (!row || row.player) {
        throw new NotFoundError(
          "No unmatched row at this rank",
          "UNMATCHED_ROW_NOT_FOUND",
        );
      }

      if (resolved) {
        ordered[rank - 1] = {
          ...resolved,
          ranking: {
            ...resolved.ranking,
            tier: fittingTier(ordered, rank - 1, row.ranking.tier),
          },
        };
      } else {
        ordered.splice(rank - 1, 1);
      }

      this.replaceAllPlayers(rankingId, ordered);
    });

    return this.getOrderedMatches(rankingId);
  }

  removePlayer(rankingId: string, sleeperId: string): PlayerMatch[] {
    this.transaction(() => {
      const ordered = this.getOrderedMatches(rankingId).filter(
        (match) => match.player?.sleeperId !== sleeperId,
      );

      this.replaceAllPlayers(rankingId, ordered);
      this.setFlag(rankingId, sleeperId, undefined);
    });

    return this.getOrderedMatches(rankingId);
  }

  /** Sets a player's flag, or clears it with `undefined`. */
  setFlag(
    rankingId: string,
    sleeperId: string,
    flag: PlayerFlag | undefined,
  ): void {
    if (flag === undefined) {
      this.database
        .prepare(
          `DELETE FROM ranking_player_flags
           WHERE ranking_id = ? AND sleeper_id = ?`,
        )
        .run(rankingId, sleeperId);

      return;
    }

    this.database
      .prepare(
        `INSERT INTO ranking_player_flags (ranking_id, sleeper_id, flag)
         VALUES (?, ?, ?)
         ON CONFLICT (ranking_id, sleeper_id) DO UPDATE SET flag = excluded.flag`,
      )
      .run(rankingId, sleeperId, flag);
  }

  /** Sleeper ID → flag, for the flagged players of a ranking. */
  getFlags(rankingId: string): Record<string, PlayerFlag> {
    const rows = this.database
      .prepare(
        `SELECT sleeper_id, flag FROM ranking_player_flags WHERE ranking_id = ?`,
      )
      .all(rankingId) as unknown as { sleeper_id: string; flag: PlayerFlag }[];

    return Object.fromEntries(rows.map((row) => [row.sleeper_id, row.flag]));
  }

  getTiers(rankingId: string): RankingTier[] {
    const positions = this.readTierPositions(rankingId);

    const counts = this.database
      .prepare(
        `SELECT tier, COUNT(*) AS count
         FROM ranking_players
         WHERE ranking_id = ?
         GROUP BY tier`,
      )
      .all(rankingId) as unknown as { tier: string; count: number }[];

    const countByLabel = new Map(counts.map((row) => [row.tier, row.count]));

    return positions.map((position) => {
      const label = numericTierToLabel(position)!;
      return {
        position,
        label,
        playerCount: countByLabel.get(label) ?? 0,
      };
    });
  }

  /** Inserts a new, empty tier at 1-based `position`, shifting that tier
   * and every one after it (and their players) one step worse. */
  insertTier(rankingId: string, position: number): RankingTier[] {
    this.transaction(() => {
      const positions = this.readTierPositions(rankingId);
      const maxPosition = positions.length > 0 ? Math.max(...positions) : 0;
      const clamped = Math.max(1, Math.min(position, maxPosition + 1));

      if (maxPosition + 1 > MAX_TIERS) {
        throw new ConflictError(
          `Cannot add more than ${MAX_TIERS} tiers`,
          "TIER_LIMIT_REACHED",
        );
      }

      this.shiftTiersFrom(rankingId, clamped, 1);

      this.database
        .prepare(
          `INSERT INTO ranking_tiers (ranking_id, position) VALUES (?, ?)`,
        )
        .run(rankingId, clamped);
    });

    return this.getTiers(rankingId);
  }

  /** Removes the tier at 1-based `position`, merging its players into the
   * next tier down — or, if it's the last (worst) tier, the tier above. */
  removeTier(rankingId: string, position: number): RankingTier[] {
    this.transaction(() => {
      const positions = this.readTierPositions(rankingId);

      if (!positions.includes(position)) {
        throw new NotFoundError(
          `Tier at position ${position} does not exist`,
          "TIER_NOT_FOUND",
        );
      }

      if (positions.length <= 1) {
        throw new ConflictError(
          "Cannot remove the only remaining tier",
          "LAST_TIER",
        );
      }

      const below = positions
        .filter((p) => p > position)
        .sort((a, b) => a - b)[0];
      const above = positions
        .filter((p) => p < position)
        .sort((a, b) => b - a)[0];
      const mergeTarget = below ?? above;

      this.relabelPlayersAtPosition(rankingId, position, mergeTarget!);

      this.database
        .prepare(
          `DELETE FROM ranking_tiers WHERE ranking_id = ? AND position = ?`,
        )
        .run(rankingId, position);

      this.shiftTiersFrom(rankingId, position + 1, -1);
    });

    return this.getTiers(rankingId);
  }

  // ---------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------

  /** Runs `fn` inside a transaction, rolling back if it throws. */
  private transaction(fn: () => void): void {
    this.database.exec("BEGIN");

    try {
      fn();
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  private getOrderedMatches(rankingId: string): PlayerMatch[] {
    const rows = this.database
      .prepare(
        `SELECT rank, tier, match_json
         FROM ranking_players
         WHERE ranking_id = ?
         ORDER BY rank ASC, id ASC`,
      )
      .all(rankingId) as unknown as RankingPlayerRow[];

    return parseMatchRows(rows);
  }

  /** Deletes and re-inserts every ranking_players row for `rankingId` in
   * the given order, renumbering rank 1..N. */
  private replaceAllPlayers(rankingId: string, matches: PlayerMatch[]): void {
    this.database
      .prepare(`DELETE FROM ranking_players WHERE ranking_id = ?`)
      .run(rankingId);

    const renumbered = matches.map((match, index) => ({
      ...match,
      ranking: { ...match.ranking, rank: index + 1 },
    }));

    this.insertPlayerRows(rankingId, renumbered);
  }

  private insertPlayerRows(rankingId: string, matches: PlayerMatch[]): void {
    const insertPlayer = this.database.prepare(
      `INSERT INTO ranking_players (
         ranking_id, rank, name, position, team, tier,
         sleeper_id, match_status, match_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    for (const match of matches) {
      const { rank, tier, ...ranking } = match.ranking;

      insertPlayer.run(
        rankingId,
        rank,
        ranking.playerName,
        ranking.position ?? null,
        ranking.team ?? null,
        tier ?? null,
        match.player?.sleeperId ?? null,
        this.getMatchStatus(match),
        JSON.stringify({ ...match, ranking }),
      );
    }
  }

  private seedTiersFromMatches(
    rankingId: string,
    matches: PlayerMatch[],
  ): void {
    const positions = new Set<number>();

    for (const match of matches) {
      const numeric = match.ranking.tier
        ? labelTierToNumeric(match.ranking.tier)
        : undefined;

      if (numeric !== undefined) {
        positions.add(numeric);
      }
    }

    if (positions.size === 0) {
      positions.add(1); // every ranking has at least one ("S") tier
    }

    const insertTier = this.database.prepare(
      `INSERT INTO ranking_tiers (ranking_id, position) VALUES (?, ?)`,
    );

    for (const position of positions) {
      insertTier.run(rankingId, position);
    }
  }

  private readTierPositions(rankingId: string): number[] {
    const rows = this.database
      .prepare(
        `SELECT position FROM ranking_tiers
         WHERE ranking_id = ? ORDER BY position ASC`,
      )
      .all(rankingId) as unknown as TierPositionRow[];

    return rows.map((row) => row.position);
  }

  /** Shifts every tier (row in ranking_tiers, plus the tier column of
   * every affected player) at or past `fromPosition` by `delta`. */
  private shiftTiersFrom(
    rankingId: string,
    fromPosition: number,
    delta: number,
  ): void {
    const positions = this.readTierPositions(rankingId).filter(
      (position) => position >= fromPosition,
    );

    // Walk in the direction that avoids colliding with the unique
    // (ranking_id, position) index while shifting.
    const ordered =
      delta > 0
        ? [...positions].sort((a, b) => b - a)
        : [...positions].sort((a, b) => a - b);

    for (const position of ordered) {
      const newPosition = position + delta;

      this.database
        .prepare(
          `UPDATE ranking_tiers SET position = ?
           WHERE ranking_id = ? AND position = ?`,
        )
        .run(newPosition, rankingId, position);

      this.relabelPlayersAtPosition(rankingId, position, newPosition);
    }
  }

  /** Moves every player whose tier currently maps to `fromPosition` so it
   * maps to `toPosition` instead. */
  private relabelPlayersAtPosition(
    rankingId: string,
    fromPosition: number,
    toPosition: number,
  ): void {
    this.database
      .prepare(
        `UPDATE ranking_players SET tier = ?
         WHERE ranking_id = ? AND tier = ?`,
      )
      .run(
        numericTierToLabel(toPosition)!,
        rankingId,
        numericTierToLabel(fromPosition)!,
      );
  }

  private getMatchStatus(
    match: PlayerMatch,
  ): "MATCHED" | "AMBIGUOUS" | "UNMATCHED" {
    if (match.player !== undefined) {
      return "MATCHED";
    }

    if (match.method === "AMBIGUOUS") {
      return "AMBIGUOUS";
    }

    return "UNMATCHED";
  }
}
