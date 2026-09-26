import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { DraftForm } from "./DraftForm";
import { MonitoringStatus } from "./MonitoringStatus";
import { RankingsUpload } from "./RankingsUpload";
import { RecommendationsList } from "./RecommendationsList";
import { useDraftRecommendations } from "../hooks/useDraftRecommendations";
import { getRankingsStatus } from "../api/fantasy-api";
import type { RankingImportSummary } from "../types/api";
import { PositionFilter } from "./PositionFilter";
import { isDebugUi } from "../config";

export function DraftDashboard() {
  const [draftId, setDraftId] = useState<string>();
  const [rankingId, setRankingId] = useState<string>();
  const [rankingSummary, setRankingSummary] = useState<RankingImportSummary>();
  const [positions, setPositions] = useState<string[]>([]);
  const [setupOpen, setSetupOpen] = useState(() => !draftId || !rankingId);

  const statusQuery = useQuery({
    queryKey: ["ranking-status"],
    queryFn: getRankingsStatus,
  });

  // Prefer a ranking imported/created in this session; otherwise fall
  // back to whatever the account's latest ranking is (from an earlier
  // session, or just created in the ranking editor).
  const effectiveRankingId = rankingId ?? statusQuery.data?.rankingId;

  const { data, error, isLoading, pollingIntervalMs, retry } =
    useDraftRecommendations(draftId, effectiveRankingId, positions);

  return (
    <>
      <MonitoringStatus
        draftId={draftId}
        rankingId={effectiveRankingId}
        draftStatus={data?.draftStatus}
        totalPicks={data?.totalPicks}
        draftedPlayerCount={data?.draftedPlayerCount}
        lastPick={data?.lastPick}
        generatedAt={data?.generatedAt}
        lastUpdatedAt={data?.lastUpdatedAt}
        pollingIntervalMs={pollingIntervalMs}
        isLoading={isLoading}
        error={error}
        onRetry={retry}
      />

      {data && (
        <>
          <PositionFilter selected={positions} onChange={setPositions} />
          <RecommendationsList recommendations={data.recommendations} />
        </>
      )}

      <details
        className="draft-setup"
        open={setupOpen}
        onToggle={(event) => setSetupOpen(event.currentTarget.open)}
      >
        <summary>Draft setup</summary>
        <div className="draft-setup__content">
          <RankingsUpload
            onImported={(summary, importedRankingId) => {
              setRankingSummary(summary);
              setRankingId(importedRankingId);
            }}
          />

          {rankingSummary ? (
            <div>
              {isDebugUi ? (
                <>
                  <h2>Rankings imported</h2>
                  <p>Imported: {rankingSummary.imported}</p>
                  <p>Matched: {rankingSummary.matched}</p>
                  <p>Unmatched: {rankingSummary.unmatched}</p>
                  <p>Ambiguous: {rankingSummary.ambiguous}</p>
                  <p>Errors: {rankingSummary.errors}</p>
                </>
              ) : (
                <p>
                  ✓ Rankings loaded ({rankingSummary.matched} players matched)
                </p>
              )}
            </div>
          ) : (
            statusQuery.data?.loaded && (
              <p>
                ✓ Using your saved ranking ({statusQuery.data.matchedCount} of{" "}
                {statusQuery.data.rankingCount} players matched)
              </p>
            )
          )}

          <DraftForm
            onSubmit={(id) => {
              setDraftId(id);
              if (rankingId) {
                setSetupOpen(false);
              }
            }}
          />
        </div>
      </details>
    </>
  );
}
