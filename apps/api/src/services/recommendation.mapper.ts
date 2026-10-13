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
    playersUpdatedAt: result.playersUpdatedAt,
    recommendationCount: result.recommendations.length,
    recommendations: result.recommendations.map(mapRecommendation),
    draft: {
      name: result.draft.name,
      type: result.draft.type,
      teams: result.draft.teams,
      rounds: result.draft.rounds,
      reversalRound: result.draft.reversalRound,
      draftOrder: result.draft.draftOrder,
      slotToRosterId: result.draft.slotToRosterId,
      tradedPicks: result.draft.tradedPicks,
      budget: result.draft.budget,
      rosterSlots: result.draft.rosterSlots,
    },
    adpFormat: result.adpFormat,
    picks: result.picks.map(mapPick),
    tierCounts: result.tierCounts,
    avoidedCount: result.avoidedCount,
  };
}

function mapRecommendation(recommendation: Recommendation) {
  return {
    rank: recommendation.ranking.rank,
    positionRank: recommendation.positionRank,
    tier: recommendation.ranking.tier,
    bye: recommendation.ranking.bye,
    note: recommendation.ranking.note,
    player: {
      sleeperId: recommendation.player.sleeperId,
      fullName: recommendation.player.fullName,
      team: recommendation.player.team,
      position: recommendation.player.position,
      injuryStatus: recommendation.player.injuryStatus,
      age: recommendation.player.age,
      rookie: recommendation.player.rookie,
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
    rosterId: pick.rosterId,
    pickedBy: pick.pickedBy,
    playerId: pick.playerId,
    playerName: pick.playerName,
    position: pick.position,
    team: pick.team,
    rank: pick.rank,
    positionRank: pick.positionRank,
    tier: pick.tier,
    bye: pick.bye,
    adp: pick.adp,
    adpPositionRank: pick.adpPositionRank,
    amount: pick.amount,
  };
}
