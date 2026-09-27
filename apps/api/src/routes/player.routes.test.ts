import Fastify from "fastify";

import { describe, expect, it } from "vitest";

import { createPlayersRoutes } from "./players.routes.js";

import { RefreshCooldownError } from "../services/player.service.js";

describe("players routes", () => {
  it("returns 429 with retryAfterMs when the refresh cooldown is active", async () => {
    const app = Fastify();

    const playerService = {
      refreshPlayersWithCooldown: async () => {
        throw new RefreshCooldownError(90_000);
      },
      getPlayerCount: () => 0,
      getCacheUpdatedAt: () => new Date(),
    };

    app.register(createPlayersRoutes(playerService as never));

    const response = await app.inject({
      method: "POST",
      url: "/players/refresh",
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({
      error: "REFRESH_COOLDOWN",
      retryAfterMs: 90_000,
    });

    await app.close();
  });

  it("refreshes successfully when no cooldown applies", async () => {
    const app = Fastify();

    const playerService = {
      refreshPlayersWithCooldown: async () => {},
      getPlayerCount: () => 1,
      getCacheUpdatedAt: () => new Date(),
    };

    app.register(createPlayersRoutes(playerService as never));

    const response = await app.inject({
      method: "POST",
      url: "/players/refresh",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", count: 1 });

    await app.close();
  });

  it("reports the cached player count in cache-status", async () => {
    const app = Fastify();

    const playerService = {
      getPlayerCount: () => 2,
      getCacheUpdatedAt: () => undefined,
    };

    app.register(createPlayersRoutes(playerService as never));

    const response = await app.inject({
      method: "GET",
      url: "/players/cache-status",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ loaded: true, count: 2 });

    await app.close();
  });
});
