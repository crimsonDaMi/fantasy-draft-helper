import { parse } from "csv-parse/sync";

import { AdpClient } from "../clients/adp.client.js";

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // Sleeper updates this every 1-2 weeks
const FAILURE_BACKOFF_MS = 5 * 60 * 1000; // don't hammer the source on repeated failure
const ADP_COLUMN = "Redraft SF ADP"; // matches this league's Superflex scoring format
const PLAYER_ID_COLUMN = "Player Id";

export class AdpService {
  private adpBySleeperId = new Map<string, number>();
  private lastSuccessAt?: Date;
  private lastAttemptAt?: Date;
  private refreshing?: Promise<void>;

  constructor(private readonly adpClient: AdpClient) { }

  /**
   * Returns the current best-known ADP snapshot, refreshing it first if
   * stale. Never throws: a fetch failure just means the previous (possibly
   * empty) snapshot is returned, so ADP is a soft dependency that can never
   * break recommendations.
   */
  async getSnapshot(): Promise<ReadonlyMap<string, number>> {
    await this.ensureFresh();
    return this.adpBySleeperId;
  }

  private async ensureFresh(): Promise<void> {
    const now = Date.now();

    const isStale =
      !this.lastSuccessAt ||
      now - this.lastSuccessAt.getTime() > REFRESH_INTERVAL_MS;

    if (!isStale) {
      return;
    }

    const recentlyFailed =
      this.lastAttemptAt !== undefined &&
      now - this.lastAttemptAt.getTime() < FAILURE_BACKOFF_MS;

    if (recentlyFailed) {
      return;
    }

    if (!this.refreshing) {
      this.refreshing = this.refresh().finally(() => {
        this.refreshing = undefined;
      });
    }

    await this.refreshing;
  }

  private async refresh(): Promise<void> {
    this.lastAttemptAt = new Date();

    try {
      const csv = await this.adpClient.getAdpCsv();

      const rows = parse(csv, {
        columns: true,
        skip_empty_lines: true,
      }) as Record<string, string>[];

      const next = new Map<string, number>();

      for (const row of rows) {
        const sleeperId = row[PLAYER_ID_COLUMN]?.trim();
        const adpValue = Number(row[ADP_COLUMN]);

        if (sleeperId && Number.isFinite(adpValue)) {
          next.set(sleeperId, adpValue);
        }
      }

      if (next.size > 0) {
        this.adpBySleeperId = next;
        this.lastSuccessAt = new Date();
      }
    } catch (error) {
      console.error(
        "Failed to refresh ADP data; serving last-known snapshot.",
        error,
      );
    }
  }
}