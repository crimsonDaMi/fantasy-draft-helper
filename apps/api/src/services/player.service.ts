import {
  SleeperClient,
} from "../clients/sleeper.client.js";

import {
  PlayerCache,
} from "../cache/player.cache.js";

import {
  Player,
} from "../domain/player.js";

import {
  mapSleeperPlayer,
} from "./player.mapper.js";

export class PlayerService {
  constructor(
    private readonly sleeperClient: SleeperClient,

    private readonly playerCache: PlayerCache,
  ) { }

  async refreshPlayers(): Promise<void> {
    const response =
      await this.sleeperClient.getNFLPlayers();

    const players =
      Object.values(response)
        .map(mapSleeperPlayer);

    this.playerCache.replace(
      players,
    );
  }

  async ensurePlayersLoaded(): Promise<void> {
    if (this.playerCache.size > 0) {
      return;
    }

    await this.refreshPlayers();
  }

  getPlayerById(
    sleeperId: string,
  ): Player | undefined {
    return this.playerCache.getById(
      sleeperId,
    );
  }

  findPlayersByName(
    name: string,
  ): Player[] {
    return this.playerCache
      .getByNormalizedName(name);
  }

  getAllPlayers(): Player[] {
    return this.playerCache.getAll();
  }

  getCacheUpdatedAt():
    | Date
    | undefined {
    return this.playerCache.updatedAt;
  }
}