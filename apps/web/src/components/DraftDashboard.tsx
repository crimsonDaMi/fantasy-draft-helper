import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";

import { DraftForm } from "./DraftForm";
import { DraftRecap } from "./DraftRecap";
import { ImportIssues } from "./ImportIssues";
import { MyTeamPanel } from "./MyTeamPanel";
import { PickAlertSettings } from "./PickAlertSettings";
import { RankingSelector } from "./RankingSelector";
import { RecentPicks } from "./RecentPicks";
import { TierCounts } from "./TierCounts";
import { MonitoringStatus } from "./MonitoringStatus";
import { RankingsUpload } from "./RankingsUpload";
import { AdpRankingStart } from "./AdpRankingStart";
import { RecommendationsList } from "./RecommendationsList";
import { SearchField } from "./SearchField";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { useDraftRecommendations } from "../hooks/useDraftRecommendations";
import { useOnTheClockAlerts } from "../hooks/useOnTheClockAlerts";
import { PHONE_QUERY, useMediaQuery } from "../hooks/useMediaQuery";
import { useSelectedRanking } from "../hooks/useSelectedRanking";
import { getDraft, setPlayerFlag } from "../api/fantasy-api";
import { queryKeys } from "../api/query-keys";
import type { PlayerFlag, RankingImportResponse } from "../types/api";
import { PositionFilter } from "./PositionFilter";
import { isDebugUi } from "../config";
import { currentPickNo, nextPickFor, picksForSlot } from "../utils/draft-order";
import {
  type PickAlertSettings as AlertSettings,
  readPickAlertSettings,
  writePickAlertSettings,
} from "../utils/pick-alerts";
import {
  clearStoredDraft,
  readStoredDraft,
  type StoredDraft,
  writeStoredDraft,
} from "../utils/stored-draft";
import { readStorage, writeStorage } from "../utils/storage";

const SHOW_NOTES_STORAGE_KEY = "draft-helper-show-notes";

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
  const [rookies, setRookies] = useState(false);
  const [showAvoided, setShowAvoided] = useState(false);
  // Remembered, so a reload mid-draft keeps the notes open.
  const [showNotes, setShowNotes] = useState(
    () => readStorage(SHOW_NOTES_STORAGE_KEY) === "true",
  );
  const [alertSettings, setAlertSettings] = useState(readPickAlertSettings);
  const debouncedSearch = useDebouncedValue(search.trim(), 250);
  // A draft restored from a previous page load resumes monitoring, so
  // setup starts collapsed just like after pressing Start.
  const [setupOpen, setSetupOpen] = useState(draftId === undefined);

  const queryClient = useQueryClient();
  // Only for the draft's ADP format, which doesn't change, so it's
  // fetched once. It works before any ranking exists, unlike the
  // recommendations, which also carry it.
  const draftQuery = useQuery({
    queryKey: queryKeys.draft(draftId),
    queryFn: () => getDraft(draftId!),
    enabled: Boolean(draftId),
    staleTime: Infinity,
  });
  const { rankings, selectedRanking, selectRanking } = useSelectedRanking();
  const effectiveRankingId = selectedRanking?.id;

  const { data, error, isLoading, pollingIntervalMs, retry } =
    useDraftRecommendations(draftId, effectiveRankingId, {
      positions,
      query: debouncedSearch,
      showAvoided,
      rookies,
    });

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
  // Picks count as the user's by their Sleeper user only when the slot is
  // theirs in the draft order. A slot chosen by hand (e.g. watching a mock
  // they aren't in) is drafted by bots or others, so it goes by slot.
  const myPicks =
    data && mySlot !== undefined
      ? picksForSlot(
          data.picks,
          mySlot,
          sleeperSlot !== undefined ? sleeperUserId : undefined,
          data.draft.slotToRosterId?.[mySlot],
        )
      : [];

  // Auctions have no pick order, so no next pick and no alerts.
  const nextPick =
    data?.draftStatus === "DRAFTING" && mySlot !== undefined
      ? nextPickFor(mySlot, currentPickNo(data.picks), data.draft)
      : undefined;
  useOnTheClockAlerts(nextPick, data?.draft.teams, alertSettings);

  function updateAlertSettings(next: AlertSettings) {
    setAlertSettings(next);
    writePickAlertSettings(next);
  }

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
              alertSettings={
                data.draft.type !== "auction" &&
                data.draftStatus !== "COMPLETE" &&
                mySlot !== undefined && (
                  <PickAlertSettings
                    settings={alertSettings}
                    onChange={updateAlertSettings}
                  />
                )
              }
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
                    rookies={rookies}
                    onRookiesChange={setRookies}
                  />
                  <SearchField
                    className="recommendation-filters__search"
                    placeholder="Search available players…"
                    value={search}
                    onValueChange={setSearch}
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
                {(showNotes ||
                  data.recommendations.some(
                    (recommendation) => recommendation.note,
                  )) && (
                  <label className="recommendation-filters__avoided">
                    <input
                      type="checkbox"
                      checked={showNotes}
                      onChange={(event) => {
                        setShowNotes(event.target.checked);
                        writeStorage(
                          SHOW_NOTES_STORAGE_KEY,
                          String(event.target.checked),
                        );
                      }}
                    />{" "}
                    Show all notes
                  </label>
                )}
                <RecommendationsList
                  recommendations={data.recommendations}
                  adpFormat={data.adpFormat}
                  showAllNotes={showNotes}
                  myPicks={myPicks}
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

          <AdpRankingStart
            defaultColumn={draftQuery.data?.adpFormat.column}
            onCreated={(rankingId) => {
              setImportResult(undefined);
              selectRanking(rankingId);
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
            <button
              type="button"
              className="button-secondary"
              onClick={() => updateStoredDraft(undefined)}
            >
              Stop monitoring
            </button>
          )}
        </div>
      </details>
    </>
  );
}
