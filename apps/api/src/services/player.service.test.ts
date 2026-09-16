import { describe, expect, it, vi } from "vitest";

import { PlayerCache } from "../cache/player.cache.js";

import { PlayerService, RefreshCooldownError } from "./player.service.js";

describe("PlayerService", () => {
  it("shares concurrent first cache loads", async () => {
    const cache = new PlayerCache();

    const service = new PlayerService({} as never, cache);

    let resolveLoad!: () => void;

    const load = new Promise<void>((resolve) => {
      resolveLoad = resolve;
    });

    const refreshPlayers = vi
      .spyOn(service, "refreshPlayers")
      .mockImplementation(async () => {
        await load;

        cache.replace([
          {
            sleeperId: "1",

            fullName: "Test Player",

            active: true,

            fantasyPositions: ["WR"],
          },
        ]);
      });

    const firstLoad = service.ensurePlayersLoaded();

    const secondLoad = service.ensurePlayersLoaded();

    await Promise.resolve();

    expect(refreshPlayers).toHaveBeenCalledTimes(1);

    resolveLoad();

    await Promise.all([firstLoad, secondLoad]);
  });
});

describe("PlayerService refresh cooldown", () => {
  function createFixtureClient() {
    return {
      getNFLPlayers: vi.fn(async () => ({
        "1": {
          player_id: "1",
          full_name: "Player One",
          position: "QB",
          team: "BUF",
          active: true,
          fantasy_positions: ["QB"],
        },
      })),
    };
  }

  it("allows a refresh when the cache has never been loaded", async () => {
    const client = createFixtureClient();
    const service = new PlayerService(client as never, new PlayerCache());

    await service.refreshPlayersWithCooldown();

    expect(service.getAllPlayers()).toHaveLength(1);
  });

  it("rejects a second refresh within the cooldown window", async () => {
    const client = createFixtureClient();
    const service = new PlayerService(client as never, new PlayerCache());

    await service.refreshPlayersWithCooldown();

    await expect(service.refreshPlayersWithCooldown()).rejects.toThrow(
      RefreshCooldownError,
    );

    expect(client.getNFLPlayers).toHaveBeenCalledTimes(1);
  });

  it("allows a refresh once the cooldown has elapsed", async () => {
    vi.useFakeTimers();

    try {
      const client = createFixtureClient();
      const service = new PlayerService(client as never, new PlayerCache());

      await service.refreshPlayersWithCooldown();

      vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

      await service.refreshPlayersWithCooldown();

      expect(client.getNFLPlayers).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});