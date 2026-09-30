import { useRef, useState } from "react";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import {
  createEmptyRanking,
  insertTier,
  moveRankingPlayer,
  removeRankingPlayer,
  removeTier,
  removeUnmatchedRow,
  resolveUnmatchedRow,
  setPlayerFlag,
} from "../api/fantasy-api";
import { queryKeys } from "../api/query-keys";
import type { PlayerFlag, RankingDetailResponse } from "../types/api";

/** Returned for a queued move that was skipped rather than saved. */
const SKIPPED = Symbol("skipped");

interface QueuedPlayerEdit {
  kind: "move" | "remove";
  variables: { sleeperId: string };
}

/** Every server mutation the ranking editor makes, each reconciling
 * exactly the queries it can affect once it settles. A failed save is
 * reported in `saveError` until the next save succeeds; the refetch on
 * settle has already put the ranking back to the server's state. */
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
  const [saveError, setSaveError] = useState<string>();

  // Shared by every mutation that saves an edit to the ranking.
  const saveCallbacks = {
    onSuccess: () => setSaveError(undefined),
    onError: (error: Error) =>
      setSaveError(`Your last change wasn't saved: ${error.message}`),
  };

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

  // Player moves and removals share a scope, so they're sent one at a time
  // in the order made, and refetch only once the last pending one settles.
  // A refetch between two quick moves would return an order from before
  // the later one, and the page would briefly show it.
  const playerEditKey = ["ranking-player-edit", rankingId];
  // The pending player edits in the order made, by their variables object
  // (TanStack passes the same one to onMutate, mutationFn, and onSettled).
  const queuedPlayerEdits = useRef<QueuedPlayerEdit[]>([]);

  // Each move carries the player's absolute target, so a queued move
  // directly followed by another move of the same player is superseded and
  // skipped — holding Alt+↓ doesn't save every step. Only a direct
  // successor counts: another player's edit in between was computed with
  // this player at the in-between position.
  function isSupersededMove(variables: object) {
    const queue = queuedPlayerEdits.current;
    const index = queue.findIndex((edit) => edit.variables === variables);
    const next = queue[index + 1];
    return (
      index !== -1 &&
      next?.kind === "move" &&
      next.variables.sleeperId === queue[index].variables.sleeperId
    );
  }

  function queuePlayerEdit(kind: QueuedPlayerEdit["kind"]) {
    return (variables: QueuedPlayerEdit["variables"]) => {
      queuedPlayerEdits.current.push({ kind, variables });
    };
  }

  const playerEditOptions = {
    mutationKey: playerEditKey,
    scope: { id: `ranking-player-edit:${rankingId}` },
    ...saveCallbacks,
    onSuccess: (result: unknown) => {
      // A skipped move saved nothing, so it can't clear an earlier error.
      if (result !== SKIPPED) {
        saveCallbacks.onSuccess();
      }
    },
    onSettled: (
      _data: unknown,
      _error: unknown,
      variables: QueuedPlayerEdit["variables"],
    ) => {
      queuedPlayerEdits.current = queuedPlayerEdits.current.filter(
        (edit) => edit.variables !== variables,
      );
      // The settling edit still counts as pending.
      if (queryClient.isMutating({ mutationKey: playerEditKey }) <= 1) {
        settleQueries();
      }
    },
  };
  const hasPendingPlayerEdits =
    useIsMutating({ mutationKey: playerEditKey }) > 0;

  function settleDetailQuery() {
    // Tier boundary and flag changes stay within the ranking — the
    // unranked pool is untouched, so only ranking-detail needs to
    // reconcile.
    void queryClient.invalidateQueries({
      queryKey: queryKeys.rankingDetail(rankingId),
    });
  }

  const moveMutation = useMutation({
    mutationFn: async (variables: {
      sleeperId: string;
      rank: number;
      tier: string;
    }) => {
      if (isSupersededMove(variables)) {
        return SKIPPED;
      }
      const { sleeperId, rank, tier } = variables;
      return moveRankingPlayer(rankingId!, sleeperId, rank, tier);
    },
    onMutate: queuePlayerEdit("move"),
    ...playerEditOptions,
  });

  const removeMutation = useMutation({
    mutationFn: ({ sleeperId }: { sleeperId: string }) =>
      removeRankingPlayer(rankingId!, sleeperId),
    onMutate: queuePlayerEdit("remove"),
    ...playerEditOptions,
  });

  // Unmatched import rows are identified by their rank (counting every
  // row) plus the name the editor last saw, which the server re-checks.
  const resolveRowMutation = useMutation({
    mutationFn: ({
      rank,
      playerName,
      sleeperId,
    }: {
      rank: number;
      playerName: string;
      sleeperId: string;
    }) => resolveUnmatchedRow(rankingId!, rank, playerName, sleeperId),
    ...saveCallbacks,
    onSettled: settleQueries,
  });

  const removeRowMutation = useMutation({
    mutationFn: ({ rank, playerName }: { rank: number; playerName: string }) =>
      removeUnmatchedRow(rankingId!, rank, playerName),
    ...saveCallbacks,
    onSettled: settleQueries,
  });

  const insertTierMutation = useMutation({
    mutationFn: ({ position }: { position: number }) =>
      insertTier(rankingId!, position),
    ...saveCallbacks,
    onSettled: settleDetailQuery,
  });

  const removeTierMutation = useMutation({
    mutationFn: ({ position }: { position: number }) =>
      removeTier(rankingId!, position),
    ...saveCallbacks,
    onSuccess: () => {
      saveCallbacks.onSuccess();
      onTierRemoved();
    },
    onSettled: settleDetailQuery,
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
    ...saveCallbacks,
    onSettled: settleDetailQuery,
  });

  return {
    moveMutation,
    removeMutation,
    resolveRowMutation,
    removeRowMutation,
    insertTierMutation,
    removeTierMutation,
    createEmptyRankingMutation,
    flagMutation,
    saveError,
    hasPendingPlayerEdits,
  };
}
