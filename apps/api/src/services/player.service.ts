import { SleeperClient } from "../clients/sleeper.client.js";
import { PlayerCache } from "../cache/player.cache.js";
import { Player } from "../domain/player.js";
import { hasRelevantFantasyPosition } from "../utils/is-fantasy-relevant-player.js";
import { mapSleeperPlayer } from "./player.mapper.js";
import { DAY_MS, HOUR_MS } from "../utils/time.js";

// Per Sleeper's own API docs: "You do not need to call this endpoint more
// than once per day." https://docs.sleeper.com/
const REFRESH_INTERVAL_MS = DAY_MS;

// How long to wait before retrying a failed automatic refresh, so draft
// polling can't hammer Sleeper while it's down.
const REFRESH_RETRY_MS = HOUR_MS;

export class PlayerService {
  private playersLoadPromise?: Promise<void>;

  private backgroundRefreshPromise?: Promise<void>;

  private lastFailedRefreshAt?: number;

  constructor(
    private readonly sleeperClient: SleeperClient,
    private readonly playerCache: PlayerCache,
  ) {}

  async refreshPlayers(): Promise<void> {
    const response = await this.sleeperClient.getNFLPlayers();

    // Drop players this league can never roster (IDP etc.). Inactive
    // players are deliberately kept so imported rankings can still match
    // them by ID/name.
    const players = Object.values(response)
      .map(mapSleeperPlayer)
      .filter(hasRelevantFantasyPosition);

    this.playerCache.replace(players);
  }

  /** Loads the cache when it's empty; once it's a day old, refreshes it in
   * the background and keeps serving the current data meanwhile. */
  async ensurePlayersLoaded(): Promise<void> {
    if (this.playerCache.size > 0) {
      this.refreshInBackgroundIfStale();

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

  private refreshInBackgroundIfStale(): void {
    const updatedAt = this.playerCache.updatedAt?.getTime() ?? 0;
    const now = Date.now();

    if (
      this.backgroundRefreshPromise ||
      now - updatedAt < REFRESH_INTERVAL_MS ||
      (this.lastFailedRefreshAt !== undefined &&
        now - this.lastFailedRefreshAt < REFRESH_RETRY_MS)
    ) {
      return;
    }

    this.backgroundRefreshPromise = this.refreshPlayers()
      .then(() => {
        this.lastFailedRefreshAt = undefined;
      })
      .catch(() => {
        // Keep the current data; retry after REFRESH_RETRY_MS.
        this.lastFailedRefreshAt = Date.now();
      })
      .finally(() => {
        this.backgroundRefreshPromise = undefined;
      });
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
