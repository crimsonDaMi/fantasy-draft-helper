import {
  describe,
  expect,
  it,
} from "vitest";

import {
  RankingStoreService,
} from "./ranking-store.service.js";

describe(
  "RankingStoreService",

  () => {
    it(
      "stores matches",

      () => {
        const store =
          new RankingStoreService();

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
          new RankingStoreService();

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
  },
);