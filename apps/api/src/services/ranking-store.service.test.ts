import { describe, expect, it } from "vitest";

import { RankingStoreService } from "./ranking-store.service.js";

import { mkdtempSync, rmSync } from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";

const TEST_USER_ID = "test-user";

describe("RankingStoreService", () => {
  it("stores matches", () => {
    const store = new RankingStoreService(":memory:");

    expect(store.hasRankings(TEST_USER_ID)).toBe(false);

    store.setMatches(
      [
        {
          ranking: {
            rank: 1,

            playerName: "Josh Allen",

            team: "BUF",

            position: "QB",
          },

          method: "NONE",
        },
      ],
      TEST_USER_ID,
    );

    expect(store.hasRankings(TEST_USER_ID)).toBe(true);

    expect(store.getMatches(TEST_USER_ID)).toHaveLength(1);
  });

  it("clears matches", () => {
    const store = new RankingStoreService(":memory:");

    store.setMatches(
      [
        {
          ranking: {
            rank: 1,

            playerName: "Josh Allen",

            team: "BUF",

            position: "QB",
          },

          method: "NONE",
        },
      ],
      TEST_USER_ID,
    );

    store.clear(TEST_USER_ID);

    expect(store.hasRankings(TEST_USER_ID)).toBe(false);
  });

  it("loads imported matches after the store is recreated", () => {
    const directory = mkdtempSync(join(tmpdir(), "fantasy-draft-helper-"));

    const databasePath = join(directory, "rankings.db");

    const firstStore = new RankingStoreService(databasePath);

    const rankingId = firstStore.setMatches(
      [
        {
          ranking: {
            rank: 1,

            playerName: "Josh Allen",

            team: "BUF",

            position: "QB",
          },

          method: "NONE",
        },
      ],
      TEST_USER_ID,
    );

    firstStore.close();

    const recreatedStore = new RankingStoreService(databasePath);

    expect(recreatedStore.hasRanking(rankingId, TEST_USER_ID)).toBe(true);

    expect(recreatedStore.getMatches(TEST_USER_ID, rankingId)).toHaveLength(1);

    recreatedStore.close();
    rmSync(directory, {
      recursive: true,
      force: true,
    });
  });

  it("returns the latest ranking id", () => {
    const store = new RankingStoreService(":memory:");

    expect(store.getLatestRankingId(TEST_USER_ID)).toBeUndefined();

    const rankingId = store.setMatches(
      [
        {
          ranking: {
            rank: 1,
            playerName: "Josh Allen",
            team: "BUF",
            position: "QB",
          },
          method: "NONE",
        },
      ],
      TEST_USER_ID,
    );

    expect(store.getLatestRankingId(TEST_USER_ID)).toBe(rankingId);
  });
});
