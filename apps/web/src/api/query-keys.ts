/**
 * TanStack Query keys, defined once so a query and the invalidations
 * that target it can't drift apart through a typo.
 */
export const queryKeys = {
  rankingList: () => ["ranking-list"] as const,
  rankingDetail: (rankingId: string | undefined) =>
    ["ranking-detail", rankingId] as const,
  rankingUnranked: (rankingId: string | undefined) =>
    ["ranking-unranked", rankingId] as const,
  /** Prefix of every `recommendations` key, for invalidating them all. */
  allRecommendations: () => ["recommendations"] as const,
  recommendations: (
    draftId: string | undefined,
    rankingId: string | undefined,
    positions: string[] | undefined,
    query: string | undefined,
    showAvoided: boolean,
  ) =>
    [
      "recommendations",
      draftId,
      rankingId,
      positions,
      query,
      showAvoided,
    ] as const,
};
