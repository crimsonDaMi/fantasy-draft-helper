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

describe("RankingRepository storage", () => {
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

  function storedRows(rawDatabase: DatabaseSync, rankingId: string) {
    return rawDatabase
      .prepare(
        `SELECT id, sleeper_id, tier_id FROM ranking_players
         WHERE ranking_id = ? ORDER BY rank`,
      )
      .all(rankingId) as unknown as {
      id: number;
      sleeper_id: string;
      tier_id: number;
    }[];
  }

  it("keeps each player's row through moves, tier changes and removals", () => {
    const { repository, rawDatabase } = createFileBackedRepository();
    const rankingId = repository.create(
      [
        tieredMatch(1, "S", "1"),
        tieredMatch(2, "S", "2"),
        tieredMatch(3, "A", "3"),
      ],
      "user-a",
    );
    const idsBefore = new Map(
      storedRows(rawDatabase, rankingId).map((row) => [row.sleeper_id, row.id]),
    );

    repository.movePlayer(rankingId, "3", 1, "S");
    repository.insertTier(rankingId, 1);
    repository.removeTier(rankingId, 1);
    repository.removePlayer(rankingId, "1");

    expect(
      storedRows(rawDatabase, rankingId).map((row) => [row.sleeper_id, row.id]),
    ).toEqual([
      ["3", idsBefore.get("3")],
      ["2", idsBefore.get("2")],
    ]);

    rawDatabase.close();
    repository.close();
  });

  it("inserts a tier without touching its players, relabelling them on read", () => {
    const { repository, rawDatabase } = createFileBackedRepository();
    const rankingId = repository.create(
      [tieredMatch(1, "S", "1"), tieredMatch(2, "A", "2")],
      "user-a",
    );
    const before = storedRows(rawDatabase, rankingId);

    repository.insertTier(rankingId, 1);

    expect(storedRows(rawDatabase, rankingId)).toEqual(before);
    expect(
      repository
        .getMatches(rankingId, "user-a")
        .map((match) => match.ranking.tier),
    ).toEqual(["A", "B"]);

    rawDatabase.close();
    repository.close();
  });

  it("stores the row's own player data, not a Sleeper snapshot", () => {
    const repository = new RankingRepository(":memory:");
    const candidate = {
      sleeperId: "9",
      fullName: "Player Nine",
      active: true,
      fantasyPositions: ["WR"],
    };
    const rankingId = repository.create(
      [
        {
          ranking: {
            rank: 1,
            playerName: "P. One",
            team: "BUF",
            position: "QB",
          },
          player: {
            sleeperId: "1",
            fullName: "Player One",
            team: "KC",
            position: "QB",
            injuryStatus: "Questionable",
            active: true,
            fantasyPositions: ["QB"],
          },
          method: "NAME_POSITION",
        },
        {
          ranking: { rank: 2, playerName: "Player Nine", position: "WR" },
          method: "AMBIGUOUS",
          candidates: [candidate],
        },
      ],
      "user-a",
    );

    const [matched, ambiguous] = repository.getMatches(rankingId, "user-a");

    // The ranking's own name and team; services overlay the live player.
    expect(matched?.player).toEqual({
      sleeperId: "1",
      fullName: "P. One",
      team: "BUF",
      position: "QB",
      active: true,
      fantasyPositions: ["QB"],
    });
    expect(matched?.method).toBe("NAME_POSITION");
    expect(ambiguous?.player).toBeUndefined();
    expect(ambiguous?.candidates).toEqual([candidate]);
  });

  it("refuses the same player twice in one ranking", () => {
    const repository = new RankingRepository(":memory:");

    expect(() =>
      repository.create(
        [tieredMatch(1, "S", "1"), tieredMatch(2, "S", "1")],
        "user-a",
      ),
    ).toThrow(/UNIQUE/);
    expect(repository.hasRankings("user-a")).toBe(false);
  });

  it("refuses to open a database from before the v3 storage redesign", () => {
    directory = mkdtempSync(join(tmpdir(), "fantasy-draft-helper-v2-"));
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
    `);
    legacy.close();

    expect(() => new RankingRepository(databasePath)).toThrow(
      /changed tables: ranking_players/,
    );
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
});
