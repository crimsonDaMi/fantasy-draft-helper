import { randomUUID } from "node:crypto";

import { DatabaseSync } from "node:sqlite";

import { openDatabase } from "./database.js";

import { PlayerMatch } from "../domain/player-match.js";

interface RankingPlayerRow {
  match_json: string;
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

      const insertPlayer = this.database.prepare(
        `INSERT INTO ranking_players (
           ranking_id,
           rank,
           name,
           position,
           team,
           tier,
           sleeper_id,
           match_status,
           match_json
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
