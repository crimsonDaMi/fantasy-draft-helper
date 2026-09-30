import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    expect(service.getPlayerCount()).toBe(1);
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

describe("PlayerService automatic refresh", () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  async function createLoadedService() {
    const cache = new PlayerCache();
    const service = new PlayerService({} as never, cache);
    const refreshPlayers = vi
      .spyOn(service, "refreshPlayers")
      .mockImplementation(async () => {
        cache.replace([
          {
            sleeperId: "1",
            fullName: "Test Player",
            active: true,
            fantasyPositions: ["WR"],
          },
        ]);
      });

    await service.ensurePlayersLoaded();

    refreshPlayers.mockClear();

    return { cache, service, refreshPlayers };
  }

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("doesn't refresh a cache less than a day old", async () => {
    const { service, refreshPlayers } = await createLoadedService();

    vi.advanceTimersByTime(DAY_MS - 1);

    await service.ensurePlayersLoaded();

    expect(refreshPlayers).not.toHaveBeenCalled();
  });

  it("refreshes a day-old cache in the background, once", async () => {
    const { cache, service, refreshPlayers } = await createLoadedService();

    let resolveRefresh!: () => void;

    refreshPlayers.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveRefresh = () => {
            cache.replace([]);
            resolve();
          };
        }),
    );

    vi.advanceTimersByTime(DAY_MS);

    // Returns without waiting for the pending refresh.
    await service.ensurePlayersLoaded();
    await service.ensurePlayersLoaded();

    expect(refreshPlayers).toHaveBeenCalledTimes(1);

    expect(service.getPlayerCount()).toBe(1);

    resolveRefresh();

    await vi.waitFor(() => expect(service.getPlayerCount()).toBe(0));
  });

  it("keeps the data after a failed refresh and retries an hour later", async () => {
    const { service, refreshPlayers } = await createLoadedService();

    refreshPlayers.mockRejectedValue(new Error("Sleeper unavailable"));

    vi.advanceTimersByTime(DAY_MS);

    await service.ensurePlayersLoaded();

    await vi.waitFor(() => expect(refreshPlayers).toHaveBeenCalledTimes(1));

    // Let the failed refresh settle before the next request.
    await vi.advanceTimersByTimeAsync(0);

    vi.advanceTimersByTime(60 * 60 * 1000 - 1);

    await service.ensurePlayersLoaded();

    expect(refreshPlayers).toHaveBeenCalledTimes(1);

    expect(service.getPlayerCount()).toBe(1);

    vi.advanceTimersByTime(1);

    await service.ensurePlayersLoaded();

    expect(refreshPlayers).toHaveBeenCalledTimes(2);
  });
});

describe("PlayerService refreshPlayers position filter", () => {
  it("drops players without a relevant fantasy position and keeps inactive ones", async () => {
    const client = {
      getNFLPlayers: vi.fn(async () => ({
        "1": {
          player_id: "1",
          full_name: "Active Quarterback",
          position: "QB",
          team: "BUF",
          active: true,
          fantasy_positions: ["QB"],
        },
        "2": {
          player_id: "2",
          full_name: "Inactive Quarterback",
          position: "QB",
          active: false,
          fantasy_positions: ["QB"],
        },
        "3": {
          player_id: "3",
          full_name: "Test Linebacker",
          position: "LB",
          team: "BUF",
          active: true,
          fantasy_positions: ["LB"],
        },
        "4": {
          player_id: "4",
          full_name: "Test Two Way",
          position: "WR",
          team: "BUF",
          active: true,
          fantasy_positions: ["WR", "CB"],
        },
      })),
    };
    const service = new PlayerService(client as never, new PlayerCache());

    await service.refreshPlayers();

    expect(
      service
        .getAllPlayers()
        .map((player) => player.sleeperId)
        .sort(),
    ).toEqual(["1", "2", "4"]);

    expect(service.getPlayerById("3")).toBeUndefined();

    expect(service.findPlayersByName("Test Linebacker")).toEqual([]);

    expect(service.getPlayerById("2")?.active).toBe(false);
  });
});
