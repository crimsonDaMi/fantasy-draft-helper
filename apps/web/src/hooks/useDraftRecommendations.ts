import {
  keepPreviousData,
  useQuery,
} from "@tanstack/react-query";

import {
  ApiRequestError,
} from "../api/fantasy-api";

import {
  getRecommendations,
} from "../api/fantasy-api";

import type {
  RecommendationsResponse,
} from "../types/api";

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

export function useDraftRecommendations(
  draftId?: string,

  rankingId?: string,
): UseDraftRecommendationsResult {
  const query = useQuery({
    queryKey: [
      "recommendations",
      draftId,
      rankingId,
    ],

    queryFn: () =>
      getRecommendations(
        draftId!,
        rankingId!,
      ),

    enabled: Boolean(
      draftId && rankingId,
    ),

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

    retryDelay: (attemptIndex) =>
      Math.min(
        1_000 * 2 ** attemptIndex,
        5_000,
      ),

    refetchInterval: (currentQuery) => {
      if (currentQuery.state.error) {
        return false;
      }

      const status =
        currentQuery.state.data
          ?.draftStatus;

      if (status === "COMPLETE") {
        return false;
      }

      if (status === "PRE_DRAFT") {
        return PRE_DRAFT_POLLING_INTERVAL_MS;
      }

      return ACTIVE_POLLING_INTERVAL_MS;
    },
  });

  const error = query.error;

  return {
    data: query.data,

    error: error instanceof Error
      ? error.message
      : error
        ? "Failed to load recommendations."
        : undefined,

    isLoading: query.isLoading,

    pollingIntervalMs: query.error
      ? false
      : query.data?.draftStatus === "COMPLETE"
        ? false
        : query.data?.draftStatus === "PRE_DRAFT"
          ? PRE_DRAFT_POLLING_INTERVAL_MS
          : draftId && rankingId
            ? ACTIVE_POLLING_INTERVAL_MS
            : undefined,

    retry: () => {
      void query.refetch();
    },
  };
}