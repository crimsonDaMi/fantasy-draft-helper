import {
  describe,
  expect,
  it,
} from "vitest";

import {
  RankingStoreService,
} from "./ranking-store.service.js";

import {
  mkdtempSync,
  rmSync,
} from "node:fs";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

describe(
  "RankingStoreService",

  () => {
    it(
      "stores matches",

      () => {
        const store =
          new RankingStoreService(
            ":memory:",
          );

        expect(
          store.hasRankings(),
        ).toBe(false);

        store.setMatches([
          {
            ranking: {
              rank: 1,

              playerName:
                "Josh Allen",

              team: "BUF",

              position: "QB",
            },

            method: "NONE",
          },
        ]);

        expect(
          store.hasRankings(),
        ).toBe(true);

        expect(
          store.getMatches(),
        ).toHaveLength(1);
      },
    );

    it(
      "clears matches",

      () => {
        const store =
          new RankingStoreService(
            ":memory:",
          );

        store.setMatches([
          {
            ranking: {
              rank: 1,

              playerName:
                "Josh Allen",

              team: "BUF",

              position: "QB",
            },

            method: "NONE",
          },
        ]);

        store.clear();

        expect(
          store.hasRankings(),
        ).toBe(false);
      },
    );

    it(
      "loads imported matches after the store is recreated",

      () => {
        const directory =
          mkdtempSync(
            join(
              tmpdir(),
              "fantasy-draft-helper-",
            ),
          );

        const databasePath = join(
          directory,
          "rankings.db",
        );

        const firstStore =
          new RankingStoreService(
            databasePath,
          );

        const rankingId =
          firstStore.setMatches([
            {
              ranking: {
                rank: 1,

                playerName:
                  "Josh Allen",

                team: "BUF",

                position: "QB",
              },

              method: "NONE",
            },
          ]);

        firstStore.close();

        const recreatedStore =
          new RankingStoreService(
            databasePath,
          );

        expect(
          recreatedStore.hasRanking(
            rankingId,
          ),
        ).toBe(true);

        expect(
          recreatedStore.getMatches(
            rankingId,
          ),
        ).toHaveLength(1);

        recreatedStore.close();
        rmSync(directory, {
          recursive: true,
          force: true,
        });
      },
    );
  },
);