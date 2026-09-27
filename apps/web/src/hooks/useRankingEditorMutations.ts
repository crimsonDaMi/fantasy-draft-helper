import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createEmptyRanking,
  insertTier,
  moveRankingPlayer,
  removeRankingPlayer,
  removeTier,
} from "../api/fantasy-api";
import { queryKeys } from "../api/query-keys";

/** Every server mutation the ranking editor makes, each reconciling
 * exactly the queries it can affect once it settles. */
export function useRankingEditorMutations(
  rankingId: string | undefined,
  { onTierRemoved }: { onTierRemoved: () => void },
) {
  const queryClient = useQueryClient();

  function settleQueries() {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.rankingDetail(rankingId),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.rankingUnranked(rankingId),
    });
  }

  function settleTierQueries() {
    // Tier boundary changes only shift tier labels/assignments within
    // the existing ranking — the unranked pool is untouched, so only
    // ranking-detail needs to reconcile.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.rankingDetail(rankingId),
    });
  }

  const moveMutation = useMutation({
    mutationFn: ({
      sleeperId,
      rank,
      tier,
    }: {
      sleeperId: string;
      rank: number;
      tier: string;
    }) => moveRankingPlayer(rankingId!, sleeperId, rank, tier),
    onSettled: settleQueries,
  });

  const removeMutation = useMutation({
    mutationFn: ({ sleeperId }: { sleeperId: string }) =>
      removeRankingPlayer(rankingId!, sleeperId),
    onSettled: settleQueries,
  });

  const insertTierMutation = useMutation({
    mutationFn: ({ position }: { position: number }) =>
      insertTier(rankingId!, position),
    onSettled: settleTierQueries,
  });

  const removeTierMutation = useMutation({
    mutationFn: ({ position }: { position: number }) =>
      removeTier(rankingId!, position),
    onSuccess: onTierRemoved,
    onSettled: settleTierQueries,
  });

  const createEmptyRankingMutation = useMutation({
    mutationFn: createEmptyRanking,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rankingStatus(),
      });
    },
  });

  return {
    moveMutation,
    removeMutation,
    insertTierMutation,
    removeTierMutation,
    createEmptyRankingMutation,
  };
}
