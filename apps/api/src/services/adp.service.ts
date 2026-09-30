import { parse } from "csv-parse/sync";
import type { FastifyBaseLogger } from "fastify";

import { AdpClient } from "../clients/adp.client.js";
import { ADP_COLUMNS, AdpColumn } from "../domain/adp-format.js";

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // Sleeper updates this every 1-2 weeks
const FAILURE_BACKOFF_MS = 5 * 60 * 1000; // don't hammer the source on repeated failure
const PLAYER_ID_COLUMN = "Player Id";

export class AdpService {
  private adpByColumn = new Map<AdpColumn, Map<string, number>>();
  private lastSuccessAt?: Date;
  private lastAttemptAt?: Date;
  private refreshing?: Promise<void>;

  constructor(
    private readonly adpClient: AdpClient,
    private readonly logger: Pick<FastifyBaseLogger, "error">,
  ) {}

  /**
   * Returns the current best-known ADP snapshot for one column of the
   * sheet, refreshing it first if stale. A column missing from the sheet
   * gives an empty snapshot. Never throws: a fetch failure just means the previous (possibly
   * empty) snapshot is returned, so ADP is a soft dependency that can never
   * break recommendations.
   */
  async getSnapshot(column: AdpColumn): Promise<ReadonlyMap<string, number>> {
    await this.ensureFresh();
    return this.adpByColumn.get(column) ?? new Map();
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

      const next = new Map<AdpColumn, Map<string, number>>();

      for (const column of ADP_COLUMNS) {
        const adpBySleeperId = new Map<string, number>();

        for (const row of rows) {
          const sleeperId = row[PLAYER_ID_COLUMN]?.trim();
          const rawValue = row[column]?.trim();
          const adpValue = Number(rawValue);

          if (sleeperId && rawValue && Number.isFinite(adpValue)) {
            adpBySleeperId.set(sleeperId, adpValue);
          }
        }

        if (adpBySleeperId.size > 0) {
          next.set(column, adpBySleeperId);
        }
      }

      if (next.size > 0) {
        this.adpByColumn = next;
        this.lastSuccessAt = new Date();
      }
    } catch (error) {
      this.logger.error(
        { err: error },
        "Failed to refresh ADP data; serving last-known snapshot.",
      );
    }
  }
}
