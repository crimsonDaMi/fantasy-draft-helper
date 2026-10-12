import { describe, expect, it } from "vitest";

import { AdpRankingService } from "./adp-ranking.service.js";
import { RankingEditorService } from "./ranking-editor.service.js";
import { RankingStoreService } from "./ranking-store.service.js";
import { toRankingCsv } from "./ranking-csv-export.js";
import { RankingRepository } from "../repositories/ranking.repository.js";

const TEST_USER_ID = "test-user";

const playerService = {
  ensurePlayersLoaded: async () => {},
  getPlayerById: (sleeperId: string) => ({
    sleeperId,
    fullName: `Player ${sleeperId}`,
    position: "WR",
    team: "KC",
    active: true,
    fantasyPositions: ["WR"],
  }),
};

describe("a ranking started from ADP", () => {
  it("can be renamed, edited and exported like an imported one", async () => {
    const repository = new RankingRepository(":memory:");
    const store = new RankingStoreService(repository);
    const editor = new RankingEditorService(repository, playerService as never);
    const adpRankingService = new AdpRankingService(
      {
        getSnapshot: async () =>
          new Map([
            ["1", 1.2],
            ["2", 2.4],
            ["3", 3.6],
          ]),
      },
      playerService,
      store,
    );

    const rankingId = await adpRankingService.createFromAdp(
      TEST_USER_ID,
      "Redraft PPR ADP",
    );

    expect(store.listRankings(TEST_USER_ID)).toEqual([
      expect.objectContaining({
        id: rankingId,
        name: "Sleeper ADP (1QB PPR)",
        playerCount: 3,
        matchedCount: 3,
      }),
    ]);

    store.renameRanking(rankingId!, TEST_USER_ID, "League A");
    expect(store.listRankings(TEST_USER_ID)[0]?.name).toBe("League A");

    const [tier] = editor.getRanking(rankingId!, TEST_USER_ID).tiers;
    await editor.movePlayer(rankingId!, TEST_USER_ID, "3", 1, tier!.label);

    const csv = toRankingCsv(store.getRankingMatches(rankingId!, TEST_USER_ID));
    // Exported with player IDs, so a re-import matches every row exactly.
    const exportedIds = csv
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => line.split(",").at(-1));

    expect(exportedIds).toEqual(["3", "1", "2"]);
  });
});
