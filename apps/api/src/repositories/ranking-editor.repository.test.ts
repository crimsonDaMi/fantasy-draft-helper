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

function unmatched(rank: number, tier: string, name: string): PlayerMatch {
  return { ranking: { rank, playerName: name, tier }, method: "NONE" };
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

    expect(() => repository.removeTier(rankingId, 1)).toThrow(
      expect.objectContaining({ name: "ConflictError", code: "LAST_TIER" }),
    );
  });

  it("rejects removing a tier that does not exist as not found", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create(
      [match(1, "S", "1"), match(2, "A", "2")],
      USER_ID,
    );

    expect(() => repository.removeTier(rankingId, 5)).toThrow(
      expect.objectContaining({
        name: "NotFoundError",
        code: "TIER_NOT_FOUND",
      }),
    );
  });

  it("rejects inserting a tier past the 26-tier limit as a conflict", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create([match(1, "S", "1")], USER_ID);

    for (let tierCount = 1; tierCount < 26; tierCount++) {
      repository.insertTier(rankingId, tierCount + 1);
    }

    expect(repository.getTiers(rankingId)).toHaveLength(26);
    expect(() => repository.insertTier(rankingId, 1)).toThrow(
      expect.objectContaining({
        name: "ConflictError",
        code: "TIER_LIMIT_REACHED",
      }),
    );
  });

  it("counts only matched players for the target rank, keeping unmatched rows in place", () => {
    const repository = new RankingRepository(":memory:");

    const rankingId = repository.create(
      [
        match(1, "S", "1"),
        unmatched(2, "S", "Nobody"),
        match(3, "S", "2"),
        match(4, "A", "3"),
      ],
      USER_ID,
    );

    // The editor shows S = [1, 2], A = [3]; moving 3 to the start of A
    // is matched rank 3, which must land after player 2, not before it.
    const result = repository.movePlayer(rankingId, "3", 3, "A");

    expect(
      result.map((m) => m.player?.sleeperId ?? m.ranking.playerName),
    ).toEqual(["1", "Nobody", "2", "3"]);
    expect(result.map((m) => m.ranking.tier)).toEqual(["S", "S", "S", "A"]);
  });

  describe("replaceUnmatchedRow", () => {
    it("resolves an unmatched row in place, keeping its tier", () => {
      const repository = new RankingRepository(":memory:");
      const rankingId = repository.create(
        [match(1, "S", "1"), unmatched(2, "S", "Nobody"), match(3, "A", "2")],
        USER_ID,
      );

      const result = repository.replaceUnmatchedRow(rankingId, 2, {
        ...match(0, "B", "9"),
        method: "MANUAL",
      });

      expect(result.map((m) => m.player?.sleeperId)).toEqual(["1", "9", "2"]);
      expect(result[1]?.ranking).toMatchObject({ rank: 2, tier: "S" });
      expect(result[1]?.method).toBe("MANUAL");
    });

    it("gives a resolved row the tier above when its own tier no longer fits there", () => {
      const repository = new RankingRepository(":memory:");
      const rankingId = repository.create(
        [match(1, "S", "1"), unmatched(2, "A", "Nobody"), match(3, "A", "2")],
        USER_ID,
      );
      // Player 2 moves to the end of S; the A row now sits between S players.
      repository.movePlayer(rankingId, "2", 2, "S");

      const result = repository.replaceUnmatchedRow(
        rankingId,
        2,
        match(0, "A", "9"),
      );

      expect(result.map((m) => m.ranking.tier)).toEqual(["S", "S", "S"]);
    });

    it("removes an unmatched row and closes the gap", () => {
      const repository = new RankingRepository(":memory:");
      const rankingId = repository.create(
        [match(1, "S", "1"), unmatched(2, "S", "Nobody"), match(3, "S", "2")],
        USER_ID,
      );

      const result = repository.replaceUnmatchedRow(rankingId, 2, undefined);

      expect(result.map((m) => m.player?.sleeperId)).toEqual(["1", "2"]);
      expect(result.map((m) => m.ranking.rank)).toEqual([1, 2]);
    });

    it("refuses a rank that holds a matched player", () => {
      const repository = new RankingRepository(":memory:");
      const rankingId = repository.create([match(1, "S", "1")], USER_ID);

      expect(() =>
        repository.replaceUnmatchedRow(rankingId, 1, undefined),
      ).toThrow("No unmatched row at this rank");
    });
  });
});
