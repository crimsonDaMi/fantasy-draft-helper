import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createEmptyRanking,
  insertTier,
  moveRankingPlayer,
  removeRankingPlayer,
  removeTier,
  setPlayerFlag,
} from "../api/fantasy-api";
import { queryKeys } from "../api/query-keys";
import type { PlayerFlag, RankingDetailResponse } from "../types/api";

/** Every server mutation the ranking editor makes, each reconciling
 * exactly the queries it can affect once it settles. */
export function useRankingEditorMutations(
  rankingId: string | undefined,
  {
    onTierRemoved,
    onRankingCreated,
  }: {
    onTierRemoved: () => void;
    onRankingCreated: (rankingId: string) => void;
  },
) {
  const queryClient = useQueryClient();

  function settleQueries() {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.rankingDetail(rankingId),
    });
    void queryClient.invalidateQueries({
      queryKey: queryKeys.rankingUnranked(rankingId),
    });
    // Player counts shown in the ranking selector.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.rankingList(),
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
    onSuccess: ({ rankingId: createdRankingId }) => {
      onRankingCreated(createdRankingId);
      void queryClient.invalidateQueries({
        queryKey: queryKeys.rankingList(),
      });
    },
  });

  // Flags only touch the detail query's `flags` map, so update it
  // optimistically — a toggle shouldn't wait for a round trip — and
  // reconcile with the server once it settles.
  const flagMutation = useMutation({
    mutationFn: ({
      sleeperId,
      flag,
    }: {
      sleeperId: string;
      flag: PlayerFlag | null;
    }) => setPlayerFlag(rankingId!, sleeperId, flag),
    onMutate: ({ sleeperId, flag }) => {
      queryClient.setQueryData<RankingDetailResponse>(
        queryKeys.rankingDetail(rankingId),
        (detail) => {
          if (!detail) {
            return detail;
          }
          const flags = { ...detail.flags };
          if (flag) {
            flags[sleeperId] = flag;
          } else {
            delete flags[sleeperId];
          }
          return { ...detail, flags };
        },
      );
    },
    onSettled: settleTierQueries,
  });

  return {
    moveMutation,
    removeMutation,
    insertTierMutation,
    removeTierMutation,
    createEmptyRankingMutation,
    flagMutation,
  };
}
