import { SleeperClient } from "../clients/sleeper.client.js";

import { PlayerCache } from "../cache/player.cache.js";

import { Player } from "../domain/player.js";

import { mapSleeperPlayer } from "./player.mapper.js";

// Per Sleeper's own API docs: "You do not need to call this endpoint more
// than once per day." https://docs.sleeper.com/
const REFRESH_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export class RefreshCooldownError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(
      `Player data was refreshed recently. Try again in ${Math.ceil(
        retryAfterMs / (60 * 1000),
      )} minute(s).`,
    );
  }
}

export class PlayerService {
  private playersLoadPromise?: Promise<void>;

  constructor(
    private readonly sleeperClient: SleeperClient,

    private readonly playerCache: PlayerCache,
  ) {}

  async refreshPlayers(): Promise<void> {
    const response = await this.sleeperClient.getNFLPlayers();

    const players = Object.values(response).map(mapSleeperPlayer);

    this.playerCache.replace(players);
  }

  async refreshPlayersWithCooldown(): Promise<void> {
    const updatedAt = this.playerCache.updatedAt;

    if (updatedAt) {
      const elapsed = Date.now() - updatedAt.getTime();

      if (elapsed < REFRESH_COOLDOWN_MS) {
        throw new RefreshCooldownError(REFRESH_COOLDOWN_MS - elapsed);
      }
    }

    await this.refreshPlayers();
  }

  async ensurePlayersLoaded(): Promise<void> {
    if (this.playerCache.size > 0) {
      return;
    }

    if (!this.playersLoadPromise) {
      this.playersLoadPromise = this.refreshPlayers();
    }

    try {
      await this.playersLoadPromise;
    } finally {
      this.playersLoadPromise = undefined;
    }
  }

  getPlayerById(sleeperId: string): Player | undefined {
    return this.playerCache.getById(sleeperId);
  }

  findPlayersByName(name: string): Player[] {
    return this.playerCache.getByNormalizedName(name);
  }

  getAllPlayers(): Player[] {
    return this.playerCache.getAll();
  }

  getCacheUpdatedAt(): Date | undefined {
    return this.playerCache.updatedAt;
  }
}
