import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiRequestError, getRecommendations } from "../api/fantasy-api";

import type { DraftStatus, RecommendationsResponse } from "../types/api";

import {
  ACTIVE_POLLING_INTERVAL_MS,
  PRE_DRAFT_POLLING_INTERVAL_MS,
} from "../config";

interface UseDraftRecommendationsResult {
  data?: RecommendationsResponse;

  error?: string;

  isLoading: boolean;

  pollingIntervalMs?: number | false;

  retry: () => void;
}

/** How often to poll for the given draft state: not at all after an
 * error (the user retries manually) or once the draft is complete,
 * slowly before it starts, and fast while it's live. */
function resolvePollingInterval(
  hasError: boolean,
  draftStatus: DraftStatus | undefined,
): number | false {
  if (hasError || draftStatus === "COMPLETE") {
    return false;
  }

  if (draftStatus === "PRE_DRAFT") {
    return PRE_DRAFT_POLLING_INTERVAL_MS;
  }

  return ACTIVE_POLLING_INTERVAL_MS;
}

export function useDraftRecommendations(
  draftId?: string,

  rankingId?: string,

  positions?: string[],
): UseDraftRecommendationsResult {
  const isEnabled = Boolean(draftId && rankingId);

  const query = useQuery({
    queryKey: ["recommendations", draftId, rankingId, positions],

    queryFn: () => getRecommendations(draftId!, rankingId!, { positions }),

    enabled: isEnabled,

    placeholderData: keepPreviousData,

    retry: (failureCount, error) => {
      if (failureCount >= 2) {
        return false;
      }

      if (
        error instanceof ApiRequestError &&
        error.status !== undefined &&
        error.status < 500
      ) {
        return false;
      }

      return true;
    },

    retryDelay: (attemptIndex) => Math.min(1_000 * 2 ** attemptIndex, 5_000),

    refetchInterval: (currentQuery) =>
      resolvePollingInterval(
        Boolean(currentQuery.state.error),
        currentQuery.state.data?.draftStatus,
      ),
  });

  const error = query.error;

  return {
    data: query.data,

    error:
      error instanceof Error
        ? error.message
        : error
          ? "Failed to load recommendations."
          : undefined,

    isLoading: query.isLoading,

    pollingIntervalMs: isEnabled
      ? resolvePollingInterval(Boolean(error), query.data?.draftStatus)
      : undefined,

    retry: () => {
      void query.refetch();
    },
  };
}
