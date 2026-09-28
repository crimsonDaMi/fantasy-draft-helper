import {
  RankedDraftPick,
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
    draft: {
      name: result.draft.name,
      type: result.draft.type,
      teams: result.draft.teams,
      rounds: result.draft.rounds,
      reversalRound: result.draft.reversalRound,
      draftOrder: result.draft.draftOrder,
      rosterSlots: result.draft.rosterSlots,
    },
    picks: result.picks.map(mapPick),
    tierCounts: result.tierCounts,
    avoidedCount: result.avoidedCount,
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
      injuryStatus: recommendation.player.injuryStatus,
    },
    adp: recommendation.adp,
    flag: recommendation.flag,
  };
}

function mapPick(pick: RankedDraftPick) {
  return {
    pickNo: pick.pickNo,
    round: pick.round,
    draftSlot: pick.draftSlot,
    pickedBy: pick.pickedBy,
    playerId: pick.playerId,
    playerName: pick.playerName,
    position: pick.position,
    team: pick.team,
    rank: pick.rank,
    tier: pick.tier,
    adp: pick.adp,
  };
}
