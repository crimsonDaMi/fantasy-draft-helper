import {
  useEffect,
  useState,
} from "react";

import {
  getRecommendations,
} from "../api/fantasy-api";

import type {
  RecommendationsResponse,
} from "../types/api";

import {
  POLLING_INTERVAL_MS,
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
  const [data, setData] =
    useState<RecommendationsResponse>();

  const [error, setError] =
    useState<string>();

  const [isLoading, setIsLoading] =
    useState(false);

  useEffect(() => {
    if (!draftId || !rankingId) {
      return;
    }

    const currentDraftId = draftId;

    const currentRankingId = rankingId;

    let cancelled = false;

    let timeoutId:
      number | undefined;

    async function poll() {
      if (cancelled) {
        return;
      }

      try {
        setIsLoading(true);

        const result =
          await getRecommendations(
            currentDraftId,

            currentRankingId,
          );

        if (!cancelled) {
          setData(result);
          setError(undefined);
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "Failed to load recommendations.",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);

          timeoutId =
            window.setTimeout(
              () => {
                void poll();
              },
              POLLING_INTERVAL_MS,
            );
        }
      }
    }

    void poll();

    return () => {
      cancelled = true;

      if (timeoutId !== undefined) {
        window.clearTimeout(
          timeoutId,
        );
      }
    };
  }, [draftId, rankingId]);

  return {
    data: draftId && rankingId
      ? data
      : undefined,
    error: draftId && rankingId
      ? error
      : undefined,
    isLoading:
      draftId && rankingId
        ? isLoading
        : false,
  };
}