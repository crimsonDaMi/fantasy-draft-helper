import { describe, expect, it } from "vitest";

import { PlayerMatch } from "../domain/player-match.js";

import { RankingRepository } from "./ranking.repository.js";

function match(rank: number, tier: string, sleeperId: string): PlayerMatch {
  return {
    ranking: {
      rank,
      playerName: `Player ${sleeperId}`,
      tier,
    },
    player: {
      sleeperId,
      fullName: `Player ${sleeperId}`,
      active: true,
      fantasyPositions: ["WR"],
    },
    method: "SLEEPER_ID" as const,
  };
}

const USER_ID = "test-user";

describe("RankingRepository editor mutations", () => {
  it("moves an existing player to a new rank and renumbers everyone between", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create(
      [match(1, "S", "1"), match(2, "S", "2"), match(3, "A", "3")],
      USER_ID,
    );

    const result = repository.movePlayer(rankingId, "3", 1, "S");

    expect(result.map((m) => m.player?.sleeperId)).toEqual(["3", "1", "2"]);
    expect(result.map((m) => m.ranking.rank)).toEqual([1, 2, 3]);
    expect(result[0]?.ranking.tier).toBe("S");
  });

  it("adds a previously-unranked player at the target position", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create(
      [match(1, "S", "1"), match(2, "S", "2")],
      USER_ID,
    );

    const newMatch = match(0, "A", "3");

    const result = repository.movePlayer(rankingId, "3", 2, "A", newMatch);

    expect(result.map((m) => m.player?.sleeperId)).toEqual(["1", "3", "2"]);
    expect(result.map((m) => m.ranking.rank)).toEqual([1, 2, 3]);
  });

  it("removes a player and closes the rank gap", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create(
      [match(1, "S", "1"), match(2, "S", "2"), match(3, "A", "3")],
      USER_ID,
    );

    const result = repository.removePlayer(rankingId, "2");

    expect(result.map((m) => m.player?.sleeperId)).toEqual(["1", "3"]);
    expect(result.map((m) => m.ranking.rank)).toEqual([1, 2]);
  });

  it("seeds tiers from the imported ranking", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create(
      [match(1, "S", "1"), match(2, "A", "2")],
      USER_ID,
    );

    const tiers = repository.getTiers(rankingId);

    expect(tiers.map((t) => t.label)).toEqual(["S", "A"]);
    expect(tiers.map((t) => t.playerCount)).toEqual([1, 1]);
  });

  it("inserts an empty tier and shifts later tiers/players", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create(
      [match(1, "S", "1"), match(2, "A", "2")],
      USER_ID,
    );

    // Insert between S (1) and A (2) -> new tier at position 2.
    const tiers = repository.insertTier(rankingId, 2);

    expect(tiers.map((t) => t.label)).toEqual(["S", "A", "B"]);
    expect(tiers.find((t) => t.label === "A")?.playerCount).toBe(0);

    const matches = repository.getMatches(rankingId, USER_ID);
    // The player originally in "A" (position 2) shifted to "B" (position 3).
    expect(matches.find((m) => m.player?.sleeperId === "2")?.ranking.tier).toBe(
      "B",
    );
  });

  it("removes a tier and merges its players into the tier below", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create(
      [match(1, "S", "1"), match(2, "A", "2"), match(3, "B", "3")],
      USER_ID,
    );

    const tiers = repository.removeTier(rankingId, 2); // remove "A"

    expect(tiers.map((t) => t.label)).toEqual(["S", "A"]); // B relabeled to A

    const matches = repository.getMatches(rankingId, USER_ID);
    expect(matches.find((m) => m.player?.sleeperId === "2")?.ranking.tier).toBe(
      "A",
    );
    expect(matches.find((m) => m.player?.sleeperId === "3")?.ranking.tier).toBe(
      "A",
    );
  });

  it("merges the last tier upward when it has no tier below it", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create(
      [match(1, "S", "1"), match(2, "A", "2")],
      USER_ID,
    );

    const tiers = repository.removeTier(rankingId, 2); // remove "A", the last tier

    expect(tiers.map((t) => t.label)).toEqual(["S"]);

    const matches = repository.getMatches(rankingId, USER_ID);
    expect(matches.find((m) => m.player?.sleeperId === "2")?.ranking.tier).toBe(
      "S",
    );
  });

  it("refuses to remove the only remaining tier", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create([match(1, "S", "1")], USER_ID);

    expect(() => repository.removeTier(rankingId, 1)).toThrow();
  });
});
