import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import { DraftForm } from "./DraftForm";
import { DraftRecap } from "./DraftRecap";
import { ImportIssues } from "./ImportIssues";
import { MyTeamPanel } from "./MyTeamPanel";
import { RankingSelector } from "./RankingSelector";
import { RecentPicks } from "./RecentPicks";
import { TierCounts } from "./TierCounts";
import { MonitoringStatus } from "./MonitoringStatus";
import { RankingsUpload } from "./RankingsUpload";
import { RecommendationsList } from "./RecommendationsList";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useDraftRecommendations } from "../hooks/useDraftRecommendations";
import { PHONE_QUERY, useMediaQuery } from "../hooks/useMediaQuery";
import { useSelectedRanking } from "../hooks/useSelectedRanking";
import { setPlayerFlag } from "../api/fantasy-api";
import { queryKeys } from "../api/query-keys";
import type { PlayerFlag, RankingImportResponse } from "../types/api";
import { PositionFilter } from "./PositionFilter";
import { isDebugUi } from "../config";
import { currentPickNo, picksForSlot } from "../utils/draft-order";
import {
  clearStoredDraft,
  readStoredDraft,
  type StoredDraft,
  writeStoredDraft,
} from "../utils/stored-draft";

/** Keep in sync with the .draft-board media query in index.css. */
const WIDE_DRAFT_BOARD_QUERY = "(min-width: 1200px)";

export function DraftDashboard() {
  const [storedDraft, setStoredDraft] = useState(readStoredDraft);
  const draftId = storedDraft?.draftId;
  // The last import's result, shown until another ranking is selected.
  const [importResult, setImportResult] = useState<RankingImportResponse>();
  const rankingSummary = importResult?.summary;
  const [positions, setPositions] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [showAvoided, setShowAvoided] = useState(false);
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  // A draft restored from a previous page load resumes monitoring, so
  // setup starts collapsed just like after pressing Start.
  const [setupOpen, setSetupOpen] = useState(draftId === undefined);

  const queryClient = useQueryClient();
  const { rankings, selectedRanking, selectRanking } = useSelectedRanking();
  const effectiveRankingId = selectedRanking?.id;

  const { data, error, isLoading, pollingIntervalMs, retry } =
    useDraftRecommendations(
      draftId,
      effectiveRankingId,
      positions,
      debouncedSearch,
      showAvoided,
    );

  const flagMutation = useMutation({
    mutationFn: ({
      sleeperId,
      flag,
    }: {
      sleeperId: string;
      flag: PlayerFlag | null;
    }) => setPlayerFlag(effectiveRankingId!, sleeperId, flag),
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.allRecommendations(),
      }),
  });

  function updateStoredDraft(next: StoredDraft | undefined) {
    setStoredDraft(next);
    if (next) {
      writeStoredDraft(next);
    } else {
      clearStoredDraft();
    }
  }

  // Sleeper's draft order wins once it's set (it's randomized shortly
  // before the draft); until then, or without a known Sleeper user, the
  // slot the user picked by hand.
  const sleeperUserId = storedDraft?.sleeperUserId;
  const sleeperSlot = sleeperUserId
    ? data?.draft.draftOrder?.[sleeperUserId]
    : undefined;
  const mySlot = sleeperSlot ?? storedDraft?.draftSlot;
  const myPicks =
    data && mySlot !== undefined
      ? picksForSlot(
          data.picks,
          mySlot,
          sleeperUserId,
          data.draft.slotToRosterId?.[mySlot],
        )
      : [];

  // Side columns only fit on wide screens (see .draft-board in
  // index.css); there tier counts move beside My team instead of
  // sitting above the recommendations.
  const isWide = useMediaQuery(WIDE_DRAFT_BOARD_QUERY);
  // On phones My team collapses to its next-pick line, so the top
  // recommendation shows without scrolling.
  const isPhone = useMediaQuery(PHONE_QUERY);
  const tierCounts = data && <TierCounts counts={data.tierCounts} />;

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
        playersUpdatedAt={data?.playersUpdatedAt}
        pollingIntervalMs={pollingIntervalMs}
        isLoading={isLoading}
        error={error}
        onRetry={retry}
      />

      {data && (
        <div className="draft-board">
          <div className="draft-board__side">
            <MyTeamPanel
              draft={data.draft}
              draftStatus={data.draftStatus}
              currentPickNo={currentPickNo(data.picks)}
              slot={mySlot}
              slotFromSleeper={sleeperSlot !== undefined}
              myPicks={myPicks}
              onSlotChange={(draftSlot) =>
                storedDraft && updateStoredDraft({ ...storedDraft, draftSlot })
              }
              collapsible={isPhone}
            />
            {isWide && data.draftStatus !== "COMPLETE" && tierCounts}
          </div>
          <div className="draft-board__main">
            {data.draftStatus === "COMPLETE" ? (
              <DraftRecap
                draft={data.draft}
                adpFormat={data.adpFormat}
                myPicks={myPicks}
              />
            ) : (
              <>
                <div className="recommendation-filters">
                  <PositionFilter
                    selected={positions}
                    onChange={setPositions}
                  />
                  <input
                    type="search"
                    className="search-input recommendation-filters__search"
                    placeholder="Search available players…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    aria-label="Search available players"
                  />
                </div>
                {!isWide && tierCounts}
                {(data.avoidedCount > 0 || showAvoided) && (
                  <label className="recommendation-filters__avoided">
                    <input
                      type="checkbox"
                      checked={showAvoided}
                      onChange={(event) => setShowAvoided(event.target.checked)}
                    />{" "}
                    Show hidden players ({data.avoidedCount})
                  </label>
                )}
                <RecommendationsList
                  recommendations={data.recommendations}
                  adpFormat={data.adpFormat}
                  onFlagChange={(sleeperId, flag) =>
                    flagMutation.mutate({ sleeperId, flag })
                  }
                />
              </>
            )}
          </div>
          <div className="draft-board__side">
            <RecentPicks picks={data.picks} teams={data.draft.teams} />
          </div>
        </div>
      )}

      <details
        className="draft-setup"
        open={setupOpen}
        onToggle={(event) => setSetupOpen(event.currentTarget.open)}
      >
        <summary>Draft setup</summary>
        <div className="draft-setup__content">
          <RankingsUpload
            onImported={(result) => {
              setImportResult(result);
              selectRanking(result.rankingId);
            }}
          />

          {rankings && selectedRanking && (
            <RankingSelector
              rankings={rankings}
              selectedRanking={selectedRanking}
              onSelect={(rankingId) => {
                setImportResult(undefined);
                selectRanking(rankingId);
              }}
            />
          )}

          {importResult && rankingSummary ? (
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
              <ImportIssues
                unmatchedPlayers={importResult.unmatchedPlayers}
                ambiguousPlayers={importResult.ambiguousPlayers}
              />
            </div>
          ) : (
            selectedRanking && (
              <p>
                ✓ Using your saved ranking ({selectedRanking.matchedCount} of{" "}
                {selectedRanking.playerCount} players matched)
                {selectedRanking.matchedCount < selectedRanking.playerCount && (
                  <>
                    {" "}
                    — <Link to="/rankings/edit">fix the rest</Link>
                  </>
                )}
              </p>
            )
          )}

          <DraftForm
            initialDraftId={draftId}
            onSubmit={(selection) => {
              updateStoredDraft(selection);
              // Monitoring can start as soon as any ranking is available —
              // imported just now or saved from an earlier session.
              if (effectiveRankingId) {
                setSetupOpen(false);
              }
            }}
          />

          {draftId && (
            <button type="button" onClick={() => updateStoredDraft(undefined)}>
              Stop monitoring
            </button>
          )}
        </div>
      </details>
    </>
  );
}
