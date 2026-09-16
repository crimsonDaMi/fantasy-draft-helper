import { describe, expect, it } from "vitest";

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

  it("clear only removes the calling user's rankings", () => {
    const repository = new RankingRepository(":memory:");

    repository.create(createMatches(), "user-a");
    repository.create(createMatches(), "user-b");

    repository.clear("user-a");

    expect(repository.hasRankings("user-a")).toBe(false);
    expect(repository.hasRankings("user-b")).toBe(true);
  });
});
