import {
  Recommendation,
  RecommendationResult,
} from "../domain/recommendation.js";

import {
  DraftStateService,
} from "./draft-state.service.js";

import {
  RankingStoreService,
} from "./ranking-store.service.js";


export class RecommendationService {
  constructor(
    private readonly draftStateService:
      DraftStateService,

    private readonly rankingStoreService:
      RankingStoreService,
  ) { }

  async getRecommendations(
    draftId: string,

    rankingId: string,

    limit: number,
  ): Promise<RecommendationResult> {
    const draftState =
      await this.draftStateService
        .getDraftState(
          draftId,
        );

    const draftedPlayerIds =
      draftState.draftedPlayerIds;

    const matches =
      this.rankingStoreService
        .getMatches(
          rankingId,
        );

    const recommendations =
      matches
        .filter(
          (match) =>
            match.player !== undefined,
        )
        .filter(
          (match) =>
            !draftedPlayerIds.has(
              match.player!
                .sleeperId,
            ),
        )
        .slice(
          0,
          limit,
        )
        .map(
          (match) => ({
            ranking:
              match.ranking,

            player:
              match.player!,
          }),
        );

    return {
      recommendations,

      draftedPlayerCount:
        draftedPlayerIds.size,

      draftStatus:
        draftState.draft.status,

      totalPicks:
        draftState.picks.length,

      lastPick:
        draftState.picks.at(-1),

      lastUpdatedAt:
        draftState.lastUpdatedAt.toISOString(),

      generatedAt:
        new Date().toISOString(),
    };
  }
}