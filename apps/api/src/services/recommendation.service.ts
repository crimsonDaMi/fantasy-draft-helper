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
        .sort(
          (a, b) =>
            a.ranking.rank -
            b.ranking.rank,
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

      generatedAt:
        new Date().toISOString(),
    };
  }
}