import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listRankings } from "../api/fantasy-api";
import { queryKeys } from "../api/query-keys";

const STORAGE_KEY = "draft-helper-ranking";

function readStoredRankingId(): string | undefined {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeStoredRankingId(rankingId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, rankingId);
  } catch {
    // Not remembered; the newest ranking is used after a reload.
  }
}

/** The user's saved rankings and the one they're working with. The
 * choice is remembered per browser; when it's missing or was deleted,
 * the newest ranking is used. */
export function useSelectedRanking() {
  const listQuery = useQuery({
    queryKey: queryKeys.rankingList(),
    queryFn: listRankings,
  });
  const [storedId, setStoredId] = useState(readStoredRankingId);

  const rankings = listQuery.data?.rankings;
  const selectedRanking =
    rankings?.find((ranking) => ranking.id === storedId) ?? rankings?.[0];

  const selectRanking = useCallback((rankingId: string) => {
    setStoredId(rankingId);
    writeStoredRankingId(rankingId);
  }, []);

  return {
    rankings,
    selectedRanking,
    selectRanking,
    isLoading: listQuery.isLoading,
  };
}
