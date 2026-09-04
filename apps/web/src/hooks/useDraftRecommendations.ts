import {
  useQuery,
} from "@tanstack/react-query";

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

    refetchInterval: (currentQuery) => {
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

    isLoading: query.isLoading ||
      query.isFetching,
  };
}