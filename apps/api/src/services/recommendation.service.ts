import {
  Recommendation,
  RecommendationResult,
} from "../domain/recommendation.js";

import {
  AdpService,
} from "./adp.service.js";

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

    private readonly adpService:
      AdpService,
  ) { }

  async getRecommendations(
    draftId: string,

    rankingId: string,

    limit: number,

    positions?: string[],
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

    const adpBySleeperId =
      await this.adpService
        .getSnapshot();

    const recommendations = matches
      .filter((match) => match.player !== undefined)
      .filter((match) => !draftedPlayerIds.has(match.player!.sleeperId))
      .filter((match) =>
        !positions || positions.length === 0
          ? true
          : Boolean(match.player!.position) &&
          positions.includes(match.player!.position!),
      )
      .slice(0, limit)
      .map((match): Recommendation => {
        const adpValue = adpBySleeperId.get(match.player!.sleeperId);

        return {
          ranking: match.ranking,
          player: match.player!,
          adp:
            adpValue === undefined
              ? undefined
              : {
                value: adpValue,
                diff: Math.round((match.ranking.rank - adpValue) * 10) / 10,
              },
        };
      });

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