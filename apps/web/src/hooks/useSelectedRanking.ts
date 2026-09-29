import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listRankings } from "../api/fantasy-api";
import { queryKeys } from "../api/query-keys";
import { readStorage, writeStorage } from "../utils/storage";

const STORAGE_KEY = "draft-helper-ranking";

/** The user's saved rankings and the one they're working with. The
 * choice is remembered per browser; when it's missing or was deleted,
 * the newest ranking is used. */
export function useSelectedRanking() {
  const listQuery = useQuery({
    queryKey: queryKeys.rankingList(),
    queryFn: listRankings,
  });
  const [storedId, setStoredId] = useState(() => readStorage(STORAGE_KEY));

  const rankings = listQuery.data?.rankings;
  const selectedRanking =
    rankings?.find((ranking) => ranking.id === storedId) ?? rankings?.[0];

  const selectRanking = useCallback((rankingId: string) => {
    setStoredId(rankingId);
    writeStorage(STORAGE_KEY, rankingId);
  }, []);

  return {
    rankings,
    selectedRanking,
    selectRanking,
    isLoading: listQuery.isLoading,
  };
}
