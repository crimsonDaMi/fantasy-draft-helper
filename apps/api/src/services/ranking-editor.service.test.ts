import { describe, expect, it, vi } from "vitest";

import { RankingEditorService } from "./ranking-editor.service.js";

import { RankingRepository } from "../repositories/ranking.repository.js";

import { PlayerMatch } from "../domain/player-match.js";

const USER_ID = "test-user";
const OTHER_USER_ID = "someone-else";

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

function createFantasyPlayer(sleeperId: string, fullName: string) {
  return {
    sleeperId,
    fullName,
    team: "BUF",
    position: "WR",
    active: true,
    fantasyPositions: ["WR"],
  };
}

function createFixturePlayerService(
  overrides: Partial<{
    getPlayerById: (id: string) => unknown;
    getAllPlayers: () => unknown[];
  }> = {},
) {
  return {
    ensurePlayersLoaded: vi.fn().mockResolvedValue(undefined),
    getPlayerById: overrides.getPlayerById ?? (() => undefined),
    getAllPlayers: overrides.getAllPlayers ?? (() => []),
  };
}

describe("RankingEditorService", () => {
  describe("movePlayer", () => {
    it("moves an already-ranked player without touching the player service", async () => {
      const repository = new RankingRepository(":memory:");

      const rankingId = repository.create(
        [match(1, "S", "1"), match(2, "S", "2"), match(3, "A", "3")],
        USER_ID,
      );

      const playerService = createFixturePlayerService();

      const service = new RankingEditorService(
        repository,
        playerService as never,
      );

      const result = await service.movePlayer(rankingId, USER_ID, "3", 1, "S");

      expect(result.map((m) => m.player?.sleeperId)).toEqual(["3", "1", "2"]);
      expect(playerService.ensurePlayersLoaded).not.toHaveBeenCalled();
    });

    it("adds a previously-unranked player by looking them up via the player service", async () => {
      const repository = new RankingRepository(":memory:");

      const rankingId = repository.create(
        [match(1, "S", "1"), match(2, "S", "2")],
        USER_ID,
      );

      const newPlayer = createFantasyPlayer("3", "Player Three");

      const playerService = createFixturePlayerService({
        getPlayerById: (id: string) => (id === "3" ? newPlayer : undefined),
      });

      const service = new RankingEditorService(
        repository,
        playerService as never,
      );

      const result = await service.movePlayer(rankingId, USER_ID, "3", 2, "A");

      expect(result.map((m) => m.player?.sleeperId)).toEqual(["1", "3", "2"]);
      expect(result[1]?.ranking.playerName).toBe("Player Three");
      expect(result[1]?.ranking.tier).toBe("A");
      expect(playerService.ensurePlayersLoaded).toHaveBeenCalledTimes(1);
    });

    it("throws 404 when adding an unranked player who isn't in the player cache", async () => {
      const repository = new RankingRepository(":memory:");

      const rankingId = repository.create([match(1, "S", "1")], USER_ID);

      const playerService = createFixturePlayerService({
        getPlayerById: () => undefined,
      });

      const service = new RankingEditorService(
        repository,
        playerService as never,
      );

      await expect(
        service.movePlayer(rankingId, USER_ID, "unknown", 1, "S"),
      ).rejects.toThrow("Player was not found");
    });

    it("throws 404 when the ranking does not belong to the user", async () => {
      const repository = new RankingRepository(":memory:");

      const rankingId = repository.create([match(1, "S", "1")], USER_ID);

      const playerService = createFixturePlayerService();

      const service = new RankingEditorService(
        repository,
        playerService as never,
      );

      await expect(
        service.movePlayer(rankingId, OTHER_USER_ID, "1", 1, "S"),
      ).rejects.toThrow("Ranking was not found");
    });
  });

  describe("getRanking", () => {
    it("returns players and tiers for the owning user", () => {
      const repository = new RankingRepository(":memory:");

      const rankingId = repository.create(
        [match(1, "S", "1"), match(2, "A", "2")],
        USER_ID,
      );

      const playerService = createFixturePlayerService();

      const service = new RankingEditorService(
        repository,
        playerService as never,
      );

      const result = service.getRanking(rankingId, USER_ID);

      expect(result.players.map((m) => m.player?.sleeperId)).toEqual([
        "1",
        "2",
      ]);
      expect(result.tiers.map((t) => t.label)).toEqual(["S", "A"]);
    });

    it("throws 404 when the ranking does not belong to the user", () => {
      const repository = new RankingRepository(":memory:");

      const rankingId = repository.create([match(1, "S", "1")], USER_ID);

      const playerService = createFixturePlayerService();

      const service = new RankingEditorService(
        repository,
        playerService as never,
      );

      expect(() => service.getRanking(rankingId, OTHER_USER_ID)).toThrow(
        "Ranking was not found",
      );
    });
  });

  describe("removePlayer", () => {
    it("removes a ranked player", () => {
      const repository = new RankingRepository(":memory:");

      const rankingId = repository.create(
        [match(1, "S", "1"), match(2, "S", "2")],
        USER_ID,
      );

      const playerService = createFixturePlayerService();

      const service = new RankingEditorService(
        repository,
        playerService as never,
      );

      const result = service.removePlayer(rankingId, USER_ID, "1");

      expect(result.map((m) => m.player?.sleeperId)).toEqual(["2"]);
    });

    it("throws 404 when the ranking does not belong to the user", () => {
      const repository = new RankingRepository(":memory:");

      const rankingId = repository.create([match(1, "S", "1")], USER_ID);

      const playerService = createFixturePlayerService();

      const service = new RankingEditorService(
        repository,
        playerService as never,
      );

      expect(() => service.removePlayer(rankingId, OTHER_USER_ID, "1")).toThrow(
        "Ranking was not found",
      );
    });
  });

  describe("insertTier", () => {
    it("inserts a tier at the given position", () => {
      const repository = new RankingRepository(":memory:");

      const rankingId = repository.create(
        [match(1, "S", "1"), match(2, "A", "2")],
        USER_ID,
      );

      const playerService = createFixturePlayerService();

      const service = new RankingEditorService(
        repository,
        playerService as never,
      );

      const tiers = service.insertTier(rankingId, USER_ID, 2);

      expect(tiers.map((t) => t.label)).toEqual(["S", "A", "B"]);
    });

    it("throws 404 when the ranking does not belong to the user", () => {
      const repository = new RankingRepository(":memory:");

      const rankingId = repository.create([match(1, "S", "1")], USER_ID);

      const playerService = createFixturePlayerService();

      const service = new RankingEditorService(
        repository,
        playerService as never,
      );

      expect(() => service.insertTier(rankingId, OTHER_USER_ID, 1)).toThrow(
        "Ranking was not found",
      );
    });
  });

  describe("removeTier", () => {
    it("removes a tier, merging players into the tier below", () => {
      const repository = new RankingRepository(":memory:");

      const rankingId = repository.create(
        [match(1, "S", "1"), match(2, "A", "2"), match(3, "B", "3")],
        USER_ID,
      );

      const playerService = createFixturePlayerService();

      const service = new RankingEditorService(
        repository,
        playerService as never,
      );

      const tiers = service.removeTier(rankingId, USER_ID, 2);

      expect(tiers.map((t) => t.label)).toEqual(["S", "A"]);
    });

    it("throws 404 when the ranking does not belong to the user", () => {
      const repository = new RankingRepository(":memory:");

      const rankingId = repository.create(
        [match(1, "S", "1"), match(2, "A", "2")],
        USER_ID,
      );

      const playerService = createFixturePlayerService();

      const service = new RankingEditorService(
        repository,
        playerService as never,
      );

      expect(() => service.removeTier(rankingId, OTHER_USER_ID, 1)).toThrow(
        "Ranking was not found",
      );
    });
  });

  describe("getUnrankedPlayers", () => {
    it("returns fantasy-relevant players not in the ranking", async () => {
      const repository = new RankingRepository(":memory:");

      const rankingId = repository.create([match(1, "S", "1")], USER_ID);

      const playerService = createFixturePlayerService({
        getAllPlayers: () => [
          createFantasyPlayer("1", "Player One"), // already ranked
          createFantasyPlayer("2", "Player Two"), // unranked, fantasy-relevant
          {
            sleeperId: "3",
            fullName: "Retired Player",
            active: false,
            fantasyPositions: ["WR"],
          }, // unranked, but not fantasy-relevant
        ],
      });

      const service = new RankingEditorService(
        repository,
        playerService as never,
      );

      const result = await service.getUnrankedPlayers(rankingId, USER_ID);

      expect(result.map((player) => player.sleeperId)).toEqual(["2"]);
      expect(playerService.ensurePlayersLoaded).toHaveBeenCalledTimes(1);
    });

    it("throws 404 when the ranking does not belong to the user", async () => {
      const repository = new RankingRepository(":memory:");

      const rankingId = repository.create([match(1, "S", "1")], USER_ID);

      const playerService = createFixturePlayerService();

      const service = new RankingEditorService(
        repository,
        playerService as never,
      );

      await expect(
        service.getUnrankedPlayers(rankingId, OTHER_USER_ID),
      ).rejects.toThrow("Ranking was not found");
    });
  });
});
