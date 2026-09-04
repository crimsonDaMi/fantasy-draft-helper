import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  PlayerCache,
} from "../cache/player.cache.js";

import {
  PlayerService,
} from "./player.service.js";

describe(
  "PlayerService",

  () => {
    it(
      "shares concurrent first cache loads",

      async () => {
        const cache = new PlayerCache();

        const service =
          new PlayerService(
            {} as never,
            cache,
          );

        let resolveLoad!: () => void;

        const load = new Promise<void>(
          (resolve) => {
            resolveLoad = resolve;
          },
        );

        const refreshPlayers = vi
          .spyOn(service, "refreshPlayers")
          .mockImplementation(async () => {
            await load;

            cache.replace([
              {
                sleeperId: "1",

                fullName: "Test Player",

                active: true,

                fantasyPositions: ["WR"],
              },
            ]);
          });

        const firstLoad =
          service.ensurePlayersLoaded();

        const secondLoad =
          service.ensurePlayersLoaded();

        await Promise.resolve();

        expect(refreshPlayers).toHaveBeenCalledTimes(
          1,
        );

        resolveLoad();

        await Promise.all([
          firstLoad,
          secondLoad,
        ]);
      },
    );
  },
);
