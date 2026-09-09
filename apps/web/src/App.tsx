import {
  useState,
} from "react";

import {
  DraftForm,
} from "./components/DraftForm";

import {
  MonitoringStatus,
} from "./components/MonitoringStatus";

import {
  RankingsUpload,
} from "./components/RankingsUpload";

import {
  RecommendationsList,
} from "./components/RecommendationsList";

import {
  useDraftRecommendations,
} from "./hooks/useDraftRecommendations";

import type {
  RankingImportSummary,
} from "./types/api";

import {
  PositionFilter
} from "./components/PositionFilter";

import {
  isDebugUi
} from "./config";

function App() {
  const [draftId, setDraftId] =
    useState<string>();

  const [rankingId, setRankingId] =
    useState<string>();

  const [
    rankingSummary,
    setRankingSummary,
  ] =
    useState<RankingImportSummary>();

  const [
    positions, setPositions
  ] =
    useState<string[]>([]);

  const {
    data,
    error,
    isLoading,
    pollingIntervalMs,
    retry,
  } =
    useDraftRecommendations(
      draftId,

      rankingId,

      positions,
    );

  return (
    <main>
      <h1>
        Fantasy Draft Helper
      </h1>

      <RankingsUpload
        onImported={(
          summary,
          importedRankingId,
        ) => {
          setRankingSummary(summary);
          setRankingId(importedRankingId);
        }}
      />

      {rankingSummary && (
        <section>
          {isDebugUi ? (
            <>
              <h2>
                Rankings Imported
              </h2>

              <p>
                Imported:{" "}
                {rankingSummary.imported}
              </p>

              <p>
                Matched:{" "}
                {rankingSummary.matched}
              </p>

              <p>
                Unmatched:{" "}
                {rankingSummary.unmatched}
              </p>

              <p>
                Ambiguous:{" "}
                {rankingSummary.ambiguous}
              </p>

              <p>
                Errors:{" "}
                {rankingSummary.errors}
              </p>
            </>
          ) : (
            <p>
              ✓ Rankings loaded ({rankingSummary.matched} players matched)
            </p>
          )}
        </section>
      )}

      <DraftForm
        onSubmit={setDraftId}
      />

      <PositionFilter
        selected={positions} onChange={setPositions}
      />

      <MonitoringStatus
        draftId={draftId}

        rankingId={rankingId}

        draftStatus={
          data?.draftStatus
        }

        totalPicks={
          data?.totalPicks
        }

        draftedPlayerCount={
          data?.draftedPlayerCount
        }

        lastPick={data?.lastPick}

        generatedAt={
          data?.generatedAt
        }

        lastUpdatedAt={
          data?.lastUpdatedAt
        }

        pollingIntervalMs={pollingIntervalMs}

        isLoading={isLoading}

        error={error}

        onRetry={retry}
      />

      {data && (
        <RecommendationsList
          recommendations={
            data.recommendations
          }
        />
      )}
    </main>
  );
}

export default App;