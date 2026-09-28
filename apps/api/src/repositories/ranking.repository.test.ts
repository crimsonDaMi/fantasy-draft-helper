import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { PlayerMatch } from "../domain/player-match.js";
import {
  MAX_RANKINGS_PER_USER,
  RankingRepository,
} from "./ranking.repository.js";

function createMatches(): PlayerMatch[] {
  return [
    {
      ranking: {
        rank: 1,
        playerName: "Player One",
        team: "BUF",
        position: "QB",
      },
      method: "NONE" as const,
    },
  ];
}

describe("RankingRepository", () => {
  it("creates a ranking scoped to the given user", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create(createMatches(), "user-a");

    expect(repository.hasRanking(rankingId, "user-a")).toBe(true);
  });

  it("returns matches for the owning user", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create(createMatches(), "user-a");

    expect(repository.getMatches(rankingId, "user-a")).toHaveLength(1);
  });

  it("does not return another user's ranking via hasRanking", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create(createMatches(), "user-a");

    expect(repository.hasRanking(rankingId, "user-b")).toBe(false);
  });

  it("does not return another user's matches via getMatches", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create(createMatches(), "user-a");

    expect(repository.getMatches(rankingId, "user-b")).toEqual([]);
  });

  it("scopes getLatestRankingId per user", () => {
    const repository = new RankingRepository(":memory:");

    const rankingA = repository.create(createMatches(), "user-a");
    const rankingB = repository.create(createMatches(), "user-b");

    expect(repository.getLatestRankingId("user-a")).toBe(rankingA);
    expect(repository.getLatestRankingId("user-b")).toBe(rankingB);
  });

  it("scopes hasRankings per user", () => {
    const repository = new RankingRepository(":memory:");

    expect(repository.hasRankings("user-a")).toBe(false);

    repository.create(createMatches(), "user-a");

    expect(repository.hasRankings("user-a")).toBe(true);
    expect(repository.hasRankings("user-b")).toBe(false);
  });

  it("keeps a user's previous rankings when creating a new one", () => {
    const repository = new RankingRepository(":memory:");

    const firstRankingId = repository.create(createMatches(), "user-a");
    const secondRankingId = repository.create(createMatches(), "user-a");

    expect(repository.hasRanking(firstRankingId, "user-a")).toBe(true);
    expect(repository.hasRanking(secondRankingId, "user-a")).toBe(true);
    expect(repository.getLatestRankingId("user-a")).toBe(secondRankingId);
  });

  it("limits how many rankings a user keeps", () => {
    const repository = new RankingRepository(":memory:");

    for (let index = 0; index < MAX_RANKINGS_PER_USER; index++) {
      repository.create([], "user-a");
    }

    expect(() => repository.create([], "user-a")).toThrow(
      /at most 20 rankings/,
    );
    expect(() => repository.create([], "user-b")).not.toThrow();
  });

  it("lists a user's rankings newest first with player counts", () => {
    const repository = new RankingRepository(":memory:");

    const older = repository.create(createMatches(), "user-a", "Older");
    const newer = repository.create([], "user-a", "Newer");
    repository.create(createMatches(), "user-b");

    const rankings = repository.listRankings("user-a");

    expect(rankings.map((ranking) => [ranking.id, ranking.name])).toEqual([
      [newer, "Newer"],
      [older, "Older"],
    ]);
    expect(rankings[0]).toMatchObject({ playerCount: 0, matchedCount: 0 });
    expect(rankings[1]?.playerCount).toBe(createMatches().length);
  });

  it("renames and deletes only the user's own rankings", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create(createMatches(), "user-a");

    expect(() => repository.rename(rankingId, "user-b", "Stolen")).toThrow(
      "Ranking was not found",
    );
    expect(() => repository.delete(rankingId, "user-b")).toThrow(
      "Ranking was not found",
    );

    repository.rename(rankingId, "user-a", "League A");
    expect(repository.listRankings("user-a")[0]?.name).toBe("League A");

    repository.delete(rankingId, "user-a");
    expect(repository.hasRanking(rankingId, "user-a")).toBe(false);
    expect(repository.getMatches(rankingId, "user-a")).toEqual([]);
  });
});

describe("RankingRepository storage of rank and tier", () => {
  let directory: string | undefined;

  afterEach(() => {
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
      directory = undefined;
    }
  });

  function createFileBackedRepository() {
    directory = mkdtempSync(join(tmpdir(), "fantasy-draft-helper-ranking-"));
    const databasePath = join(directory, "test.db");

    return {
      repository: new RankingRepository(databasePath),
      rawDatabase: new DatabaseSync(databasePath),
    };
  }

  function tieredMatch(rank: number, tier: string, sleeperId: string) {
    return {
      ranking: { rank, playerName: `Player ${sleeperId}`, tier },
      player: {
        sleeperId,
        fullName: `Player ${sleeperId}`,
        active: true,
        fantasyPositions: ["QB"],
      },
      method: "SLEEPER_ID" as const,
    };
  }

  it("keeps rank and tier out of match_json, in their columns only", () => {
    const { repository, rawDatabase } = createFileBackedRepository();

    const rankingId = repository.create(
      [tieredMatch(1, "S", "1"), tieredMatch(2, "A", "2")],
      "user-a",
    );
    repository.movePlayer(rankingId, "2", 1, "S");
    repository.insertTier(rankingId, 1);

    const rows = rawDatabase
      .prepare(
        `SELECT rank, tier, match_json FROM ranking_players
         WHERE ranking_id = ? ORDER BY rank`,
      )
      .all(rankingId) as unknown as {
      rank: number;
      tier: string;
      match_json: string;
    }[];

    expect(rows.map((row) => [row.rank, row.tier])).toEqual([
      [1, "A"],
      [2, "A"],
    ]);

    for (const row of rows) {
      const stored = JSON.parse(row.match_json) as {
        ranking: Record<string, unknown>;
      };
      expect(stored.ranking).not.toHaveProperty("rank");
      expect(stored.ranking).not.toHaveProperty("tier");
    }

    expect(
      repository
        .getMatches(rankingId, "user-a")
        .map((match) => [match.player?.sleeperId, match.ranking]),
    ).toEqual([
      ["2", { rank: 1, playerName: "Player 2", tier: "A" }],
      ["1", { rank: 2, playerName: "Player 1", tier: "A" }],
    ]);

    rawDatabase.close();
    repository.close();
  });

  it("reads rank and tier from the columns for rows that still carry them in match_json", () => {
    const { repository, rawDatabase } = createFileBackedRepository();

    const rankingId = repository.create([tieredMatch(1, "S", "1")], "user-a");

    // A row written before rank/tier moved out of match_json, whose JSON
    // copy no longer matches the columns.
    rawDatabase
      .prepare(`UPDATE ranking_players SET match_json = ? WHERE ranking_id = ?`)
      .run(JSON.stringify(tieredMatch(7, "C", "1")), rankingId);

    expect(repository.getMatches(rankingId, "user-a")[0]?.ranking).toEqual({
      rank: 1,
      playerName: "Player 1",
      tier: "S",
    });

    rawDatabase.close();
    repository.close();
  });
});

describe("RankingRepository player flags", () => {
  let directory: string | undefined;

  afterEach(() => {
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
      directory = undefined;
    }
  });

  function flaggableMatch(rank: number, sleeperId: string): PlayerMatch {
    return {
      ranking: { rank, playerName: `Player ${sleeperId}`, tier: "S" },
      player: {
        sleeperId,
        fullName: `Player ${sleeperId}`,
        active: true,
        fantasyPositions: ["WR"],
      },
      method: "SLEEPER_ID",
    };
  }

  it("sets, replaces, and clears flags, surviving editor moves", () => {
    const repository = new RankingRepository(":memory:");
    const rankingId = repository.create(
      [flaggableMatch(1, "1"), flaggableMatch(2, "2")],
      "user-a",
    );

    repository.setFlag(rankingId, "1", "watch");
    repository.setFlag(rankingId, "2", "watch");
    repository.setFlag(rankingId, "2", "avoid");
    repository.movePlayer(rankingId, "2", 1, "S");

    expect(repository.getFlags(rankingId)).toEqual({
      "1": "watch",
      "2": "avoid",
    });

    repository.setFlag(rankingId, "1", undefined);

    expect(repository.getFlags(rankingId)).toEqual({ "2": "avoid" });
  });

  it("drops a player's flag when they leave the ranking, and with the ranking", () => {
    const repository = new RankingRepository(":memory:");
    const rankingId = repository.create(
      [flaggableMatch(1, "1"), flaggableMatch(2, "2")],
      "user-a",
    );

    repository.setFlag(rankingId, "1", "avoid");
    repository.setFlag(rankingId, "2", "watch");
    repository.removePlayer(rankingId, "1");

    expect(repository.getFlags(rankingId)).toEqual({ "2": "watch" });

    repository.delete(rankingId, "user-a");

    expect(repository.getFlags(rankingId)).toEqual({});
  });

  it("opens a v1.1.0 database, which has no flags table yet", () => {
    directory = mkdtempSync(join(tmpdir(), "fantasy-draft-helper-flags-"));
    const databasePath = join(directory, "test.db");
    const legacy = new DatabaseSync(databasePath);

    legacy.exec(`
      CREATE TABLE rankings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE ranking_players (
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
      CREATE TABLE ranking_tiers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ranking_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        FOREIGN KEY (ranking_id) REFERENCES rankings(id)
          ON DELETE CASCADE
      );
      INSERT INTO rankings VALUES ('ranking-1', 'user-a', 'Old', '2026-01-01');
    `);
    legacy.close();

    const repository = new RankingRepository(databasePath);

    expect(repository.hasRanking("ranking-1", "user-a")).toBe(true);
    expect(() => repository.setFlag("ranking-1", "1", "watch")).not.toThrow();

    repository.close();
  });
});
