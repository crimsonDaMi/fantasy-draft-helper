import { afterEach, describe, expect, it } from "vitest";

import { mkdtempSync, rmSync } from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";

import { DatabaseSync } from "node:sqlite";

import { PlayerMatch } from "../domain/player-match.js";

import { RankingRepository } from "./ranking.repository.js";

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

  it("replacing a user's ranking leaves other users' rankings intact", () => {
    const repository = new RankingRepository(":memory:");

    repository.create(createMatches(), "user-a");
    const userBRankingId = repository.create(createMatches(), "user-b");

    repository.create(createMatches(), "user-a");

    expect(repository.hasRanking(userBRankingId, "user-b")).toBe(true);
  });

  it("replaces a user's previous ranking when creating a new one", () => {
    const repository = new RankingRepository(":memory:");

    const firstRankingId = repository.create(createMatches(), "user-a");
    const secondRankingId = repository.create(createMatches(), "user-a");

    expect(repository.hasRanking(firstRankingId, "user-a")).toBe(false);
    expect(repository.hasRanking(secondRankingId, "user-a")).toBe(true);
    expect(repository.getLatestRankingId("user-a")).toBe(secondRankingId);
  });

  it("does not affect another user's ranking when replacing", () => {
    const repository = new RankingRepository(":memory:");

    const otherUsersRankingId = repository.create(createMatches(), "user-b");

    repository.create(createMatches(), "user-a");

    expect(repository.hasRanking(otherUsersRankingId, "user-b")).toBe(true);
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
