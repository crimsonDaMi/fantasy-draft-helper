import {
  Recommendation,
  RecommendationResult,
} from "../domain/recommendation.js";

export function mapRecommendationsResponse(
  draftId: string,

  result: RecommendationResult,
) {
  return {
    draftId,

    draftStatus: result.draftStatus,

    totalPicks: result.totalPicks,

    draftedPlayerCount: result.draftedPlayerCount,

    lastPick: result.lastPick,

    lastUpdatedAt: result.lastUpdatedAt,

    generatedAt: result.generatedAt,

    recommendationCount: result.recommendations.length,

    recommendations: result.recommendations.map(mapRecommendation),
  };
}

function mapRecommendation(recommendation: Recommendation) {
  return {
    rank: recommendation.ranking.rank,

    tier: recommendation.ranking.tier,

    player: {
      sleeperId: recommendation.player.sleeperId,

      fullName: recommendation.player.fullName,

      team: recommendation.player.team,

      position: recommendation.player.position,
    },

    adp: recommendation.adp,
  };
}
