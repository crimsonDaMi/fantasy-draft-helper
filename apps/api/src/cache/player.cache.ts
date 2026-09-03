import { Player } from "../domain/player.js";

import {
  normalizePlayerName,
} from "../utils/normalize-player-name.js";

export class PlayerCache {
  private playersById =
    new Map<string, Player>();

  private playersByNormalizedName =
    new Map<string, Player[]>();

  private lastUpdatedAt?: Date;

  replace(
    players: Player[],
  ): void {
    this.playersById.clear();

    this.playersByNormalizedName.clear();

    for (const player of players) {
      this.playersById.set(
        player.sleeperId,
        player,
      );

      const normalizedName =
        normalizePlayerName(
          player.fullName,
        );

      const existing =
        this.playersByNormalizedName.get(
          normalizedName,
        ) ?? [];

      existing.push(player);

      this.playersByNormalizedName.set(
        normalizedName,
        existing,
      );
    }

    this.lastUpdatedAt =
      new Date();
  }

  getById(
    sleeperId: string,
  ): Player | undefined {
    return this.playersById.get(
      sleeperId,
    );
  }

  getByNormalizedName(
    name: string,
  ): Player[] {
    const normalizedName =
      normalizePlayerName(name);

    return (
      this.playersByNormalizedName.get(
        normalizedName,
      ) ?? []
    );
  }

  getAll(): Player[] {
    return [
      ...this.playersById.values(),
    ];
  }

  get size(): number {
    return this.playersById.size;
  }

  get updatedAt(): Date | undefined {
    return this.lastUpdatedAt;
  }

  clear(): void {
    this.playersById.clear();

    this.playersByNormalizedName.clear();

    this.lastUpdatedAt = undefined;
  }
}