/**
 * TanStack Query keys, defined once so a query and the invalidations
 * that target it can't drift apart through a typo.
 */
export const queryKeys = {
  rankingStatus: () => ["ranking-status"] as const,
  rankingDetail: (rankingId: string | undefined) =>
    ["ranking-detail", rankingId] as const,
  rankingUnranked: (rankingId: string | undefined) =>
    ["ranking-unranked", rankingId] as const,
  recommendations: (
    draftId: string | undefined,
    rankingId: string | undefined,
    positions: string[] | undefined,
  ) => ["recommendations", draftId, rankingId, positions] as const,
};
