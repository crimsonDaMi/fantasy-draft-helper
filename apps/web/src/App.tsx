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
        </section>
      )}

      <DraftForm
        onSubmit={setDraftId}
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