import {
  describe,
  expect,
  it,
} from "vitest";

import {
  PlayerCache,
} from "../cache/player.cache.js";

import {
  SleeperClient,
} from "../clients/sleeper.client.js";

import {
  DraftService,
} from "./draft.service.js";

import {
  DraftStateService,
} from "./draft-state.service.js";

import {
  PlayerService,
} from "./player.service.js";

import {
  RecommendationService,
} from "./recommendation.service.js";

import {
  RankingStoreService,
} from "./ranking-store.service.js";

import type {
  SleeperDraft,
  SleeperDraftPick,
  SleeperPlayersResponse,
} from "../types/sleeper.js";

interface DraftFixture {
  draft: SleeperDraft;
  picks: SleeperDraftPick[];
}

function createFixtureClient(
  fixture: DraftFixture,
) {
  return {
    getDraft: async () => fixture.draft,

    getDraftPicks: async () => fixture.picks,

    getNFLPlayers: async () =>
      ({
        "1": {
          player_id: "1",
          full_name: "Player One",
          position: "QB",
          team: "BUF",
          active: true,
          fantasy_positions: ["QB"],
        },
        "2": {
          player_id: "2",
          full_name: "Player Two",
          position: "RB",
          team: "MIA",
          active: true,
          fantasy_positions: ["RB"],
        },
      }) satisfies SleeperPlayersResponse,
  } as unknown as SleeperClient;
}

function createRecommendationFixture(
  fixture: DraftFixture,
) {
  const client = createFixtureClient(
    fixture,
  );

  const playerService = new PlayerService(
    client,
    new PlayerCache(),
  );

  const draftStateService =
    new DraftStateService(
      new DraftService(client),
      playerService,
    );

  const noopAdpService = {
    getSnapshot: async () => new Map<string, number>(),
  };

  const rankingStore =
    new RankingStoreService(":memory:");

  const rankingId = rankingStore.setMatches([
    {
      ranking: {
        rank: 1,
        playerName: "Player One",
        team: "BUF",
        position: "QB",
      },
      player: {
        sleeperId: "1",
        fullName: "Player One",
        team: "BUF",
        position: "QB",
        active: true,
        fantasyPositions: ["QB"],
      },
      method: "SLEEPER_ID",
    },
    {
      ranking: {
        rank: 2,
        playerName: "Player Two",
        team: "MIA",
        position: "RB",
      },
      player: {
        sleeperId: "2",
        fullName: "Player Two",
        team: "MIA",
        position: "RB",
        active: true,
        fantasyPositions: ["RB"],
      },
      method: "SLEEPER_ID",
    },
    {
      ranking: {
        rank: 3,
        playerName: "Unmatched Player",
      },
      method: "NONE",
    },
    {
      ranking: {
        rank: 4,
        playerName: "Ambiguous Player",
      },
      method: "AMBIGUOUS",
      candidates: [],
    },
  ]);

  return {
    fixture,
    rankingStore,
    rankingId,
    service: new RecommendationService(
      draftStateService,
      rankingStore,
      noopAdpService as never,
    ),
  };
}

describe(
  "recommendation flow",
  () => {
    it(
      "updates recommendations after a drafted pick",
      async () => {
        const fixture: DraftFixture = {
          draft: {
            draft_id: "draft-1",
            status: "drafting",
            sport: "nfl",
            season: "2026",
          },
          picks: [],
        };

        const flow =
          createRecommendationFixture(
            fixture,
          );

        const beforePick =
          await flow.service.getRecommendations(
            "draft-1",
            flow.rankingId,
            10,
          );

        expect(
          beforePick.recommendations.map(
            ({ player }) => player.sleeperId,
          ),
        ).toEqual(["1", "2"]);

        fixture.picks.push({
          player_id: "1",
          pick_no: 1,
          round: 1,
        });

        const afterPick =
          await flow.service.getRecommendations(
            "draft-1",
            flow.rankingId,
            10,
          );

        expect(
          afterPick.recommendations.map(
            ({ player }) => player.sleeperId,
          ),
        ).toEqual(["2"]);

        expect(afterPick.totalPicks).toBe(1);
        expect(afterPick.lastPick?.playerId).toBe(
          "1",
        );

        flow.rankingStore.close();
      },
    );

    it(
      "excludes unmatched and ambiguous players",
      async () => {
        const fixture: DraftFixture = {
          draft: {
            draft_id: "draft-1",
            status: "pre_draft",
            sport: "nfl",
            season: "2026",
          },
          picks: [],
        };

        const flow =
          createRecommendationFixture(
            fixture,
          );

        const result =
          await flow.service.getRecommendations(
            "draft-1",
            flow.rankingId,
            10,
          );

        expect(
          result.recommendations.map(
            ({ ranking }) => ranking.playerName,
          ),
        ).toEqual([
          "Player One",
          "Player Two",
        ]);

        expect(result.draftStatus).toBe(
          "PRE_DRAFT",
        );

        flow.rankingStore.close();
      },
    );

    it(
      "reports completed draft state",
      async () => {
        const fixture: DraftFixture = {
          draft: {
            draft_id: "draft-1",
            status: "complete",
            sport: "nfl",
            season: "2026",
          },
          picks: [
            {
              player_id: "1",
              pick_no: 1,
              round: 1,
            },
          ],
        };

        const flow =
          createRecommendationFixture(
            fixture,
          );

        const result =
          await flow.service.getRecommendations(
            "draft-1",
            flow.rankingId,
            10,
          );

        expect(result.draftStatus).toBe(
          "COMPLETE",
        );
        expect(result.totalPicks).toBe(1);

        flow.rankingStore.close();
      },
    );
  },
);
