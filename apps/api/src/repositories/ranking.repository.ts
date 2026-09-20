import { randomUUID } from "node:crypto";

import { DatabaseSync } from "node:sqlite";

import { openDatabase } from "./database.js";

import { PlayerMatch } from "../domain/player-match.js";

import { RankingTier } from "../domain/ranking-tier.js";

import { labelTierToNumeric, numericTierToLabel } from "../utils/tier.js";

interface RankingPlayerRow {
  match_json: string;
}

interface TierPositionRow {
  position: number;
}

export class RankingRepository {
  private readonly database: DatabaseSync;

  constructor(databasePath?: string) {
    this.database = openDatabase(databasePath);

    this.database.exec(`
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
    `);
  }

  create(
    matches: PlayerMatch[],
    userId: string,
    name = "Imported ranking",
  ): string {
    const rankingId = randomUUID();
    const createdAt = new Date().toISOString();

    this.database.exec("BEGIN");

    try {
      this.database
        .prepare(
          `INSERT INTO rankings (id, user_id, name, created_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(rankingId, userId, name, createdAt);

      this.insertPlayerRows(rankingId, matches);
      this.seedTiersFromMatches(rankingId, matches);

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }

    return rankingId;
  }

  getMatches(rankingId: string, userId: string): PlayerMatch[] {
    const rows = this.database
      .prepare(
        `SELECT ranking_players.match_json AS match_json
         FROM ranking_players
         JOIN rankings ON rankings.id = ranking_players.ranking_id
         WHERE ranking_players.ranking_id = ? AND rankings.user_id = ?
         ORDER BY ranking_players.rank ASC, ranking_players.id ASC`,
      )
      .all(rankingId, userId) as unknown as RankingPlayerRow[];

    return rows.map((row) => JSON.parse(row.match_json) as PlayerMatch);
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

  clear(userId: string): void {
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
   */
  movePlayer(
    rankingId: string,
    sleeperId: string,
    targetRank: number,
    targetTier: string,
    newMatch?: PlayerMatch,
  ): PlayerMatch[] {
    this.database.exec("BEGIN");

    try {
      const ordered = this.getOrderedMatches(rankingId);

      const currentIndex = ordered.findIndex(
        (match) => match.player?.sleeperId === sleeperId,
      );

      let entry: PlayerMatch;

      if (currentIndex !== -1) {
        [entry] = ordered.splice(currentIndex, 1);
      } else {
        if (!newMatch) {
          throw new Error(
            `Player ${sleeperId} is not ranked and no new match was supplied`,
          );
        }
        entry = newMatch;
      }

      entry = {
        ...entry,
        ranking: { ...entry.ranking, tier: targetTier },
      };

      const insertAt = Math.max(0, Math.min(targetRank - 1, ordered.length));
      ordered.splice(insertAt, 0, entry);

      this.replaceAllPlayers(rankingId, ordered);

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }

    return this.getOrderedMatches(rankingId);
  }

  removePlayer(rankingId: string, sleeperId: string): PlayerMatch[] {
    this.database.exec("BEGIN");

    try {
      const ordered = this.getOrderedMatches(rankingId).filter(
        (match) => match.player?.sleeperId !== sleeperId,
      );

      this.replaceAllPlayers(rankingId, ordered);

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }

    return this.getOrderedMatches(rankingId);
  }

  getTiers(rankingId: string): RankingTier[] {
    return this.readTiers(rankingId);
  }

  /** Inserts a new, empty tier at 1-based `position`, shifting that tier
   * and every one after it (and their players) one step worse. */
  insertTier(rankingId: string, position: number): RankingTier[] {
    this.database.exec("BEGIN");

    try {
      const positions = this.readTierPositions(rankingId);
      const maxPosition = positions.length > 0 ? Math.max(...positions) : 0;
      const clamped = Math.max(1, Math.min(position, maxPosition + 1));

      if (maxPosition + 1 > 26) {
        throw new Error("Cannot add more than 26 tiers");
      }

      this.shiftTiersFrom(rankingId, clamped, 1);

      this.database
        .prepare(
          `INSERT INTO ranking_tiers (ranking_id, position) VALUES (?, ?)`,
        )
        .run(rankingId, clamped);

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }

    return this.readTiers(rankingId);
  }

  /** Removes the tier at 1-based `position`, merging its players into the
   * next tier down — or, if it's the last (worst) tier, the tier above. */
  removeTier(rankingId: string, position: number): RankingTier[] {
    this.database.exec("BEGIN");

    try {
      const positions = this.readTierPositions(rankingId);

      if (!positions.includes(position)) {
        throw new Error(`Tier at position ${position} does not exist`);
      }

      if (positions.length <= 1) {
        throw new Error("Cannot remove the only remaining tier");
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

      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }

    return this.readTiers(rankingId);
  }

  // ---------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------

  private getOrderedMatches(rankingId: string): PlayerMatch[] {
    const rows = this.database
      .prepare(
        `SELECT match_json AS match_json
         FROM ranking_players
         WHERE ranking_id = ?
         ORDER BY rank ASC, id ASC`,
      )
      .all(rankingId) as unknown as RankingPlayerRow[];

    return rows.map((row) => JSON.parse(row.match_json) as PlayerMatch);
  }

  /** Deletes and re-inserts every ranking_players row for `rankingId` in
   * the given order, renumbering rank 1..N and syncing match_json. */
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
      insertPlayer.run(
        rankingId,
        match.ranking.rank,
        match.ranking.playerName,
        match.ranking.position ?? null,
        match.ranking.team ?? null,
        match.ranking.tier ?? null,
        match.player?.sleeperId ?? null,
        this.getMatchStatus(match),
        JSON.stringify(match),
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

  private readTiers(rankingId: string): RankingTier[] {
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

  /** Shifts every tier (row in ranking_tiers, plus the tier column/JSON of
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

  /** Rewrites every player row (column + match_json) whose tier currently
   * maps to `fromPosition` so it maps to `toPosition` instead. */
  private relabelPlayersAtPosition(
    rankingId: string,
    fromPosition: number,
    toPosition: number,
  ): void {
    const fromLabel = numericTierToLabel(fromPosition)!;
    const toLabel = numericTierToLabel(toPosition)!;

    const rows = this.database
      .prepare(
        `SELECT id, match_json FROM ranking_players
         WHERE ranking_id = ? AND tier = ?`,
      )
      .all(rankingId, fromLabel) as unknown as {
      id: number;
      match_json: string;
    }[];

    const update = this.database.prepare(
      `UPDATE ranking_players SET tier = ?, match_json = ? WHERE id = ?`,
    );

    for (const row of rows) {
      const match = JSON.parse(row.match_json) as PlayerMatch;
      const updated: PlayerMatch = {
        ...match,
        ranking: { ...match.ranking, tier: toLabel },
      };
      update.run(toLabel, JSON.stringify(updated), row.id);
    }
  }

  private getMatchStatus(match: PlayerMatch): string {
    if (match.player !== undefined) {
      return "MATCHED";
    }

    if (match.method === "AMBIGUOUS") {
      return "AMBIGUOUS";
    }

    return "UNMATCHED";
  }
}
