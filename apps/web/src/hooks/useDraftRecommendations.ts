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
): UseDraftRecommendationsResult {
  const [data, setData] =
    useState<RecommendationsResponse>();

  const [error, setError] =
    useState<string>();

  const [isLoading, setIsLoading] =
    useState(false);

  useEffect(() => {
    if (!draftId) {
      return;
    }

    const currentDraftId = draftId;

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
  }, [draftId]);

  return {
    data: draftId ? data : undefined,
    error: draftId ? error : undefined,
    isLoading: draftId ? isLoading : false,
  };
}