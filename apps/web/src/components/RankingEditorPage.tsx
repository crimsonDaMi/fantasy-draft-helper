import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useQuery } from "@tanstack/react-query";

import { getRanking, getUnrankedPlayers } from "../api/fantasy-api";
import { queryKeys } from "../api/query-keys";
import { useContainerCollisionDetection } from "../hooks/useContainerCollisionDetection";
import { useEdgeAutoscroll } from "../hooks/useEdgeAutoscroll";
import { PHONE_QUERY, useMediaQuery } from "../hooks/useMediaQuery";
import { useRankingEditorMutations } from "../hooks/useRankingEditorMutations";
import { useSelectedRanking } from "../hooks/useSelectedRanking";
import type { RankingTierDto } from "../types/api";
import { PositionFilter } from "./PositionFilter";
import { RankingSelector } from "./RankingSelector";
import { AddTierButton } from "./ranking-editor/AddTierButton";
import { DroppableContainer } from "./ranking-editor/DroppableContainer";
import { EditorHints } from "./ranking-editor/EditorHints";
import { EditorToolbar } from "./ranking-editor/EditorToolbar";
import { PlayerLabel } from "./ranking-editor/PlayerLabel";
import { PlayerMoveMenu } from "./ranking-editor/PlayerMoveMenu";
import { SegmentedToggle } from "./ranking-editor/SegmentedToggle";
import { StartRankingPrompt } from "./ranking-editor/StartRankingPrompt";
import {
  UNRANKED_CONTAINER,
  appendPlayerToTier,
  buildContainers,
  computeGlobalRank,
  filterPlayers,
  formatTierHeading,
  movePlayerToContainer,
  stepPlayer,
  type Containers,
  type EditorPlayer,
  type KeyboardMove,
  type TierDisplayMode,
} from "./ranking-editor-logic";
import { ErrorMessage } from "./ErrorMessage";

// Mouse drags start after a few pixels; touch drags need a long press,
// so a swipe on a row scrolls the list instead of grabbing the player.
const MOUSE_DRAG_DISTANCE_PX = 4;
const TOUCH_DRAG_DELAY_MS = 200;
const TOUCH_DRAG_TOLERANCE_PX = 8;
// A touch drag's release can still fire a click on the row; clicks this
// soon after a drag ends are ignored.
const POST_DRAG_CLICK_GUARD_MS = 400;

// Replaces dnd-kit's default "press space to pick up" text: there's no
// keyboard drag, rows have keyboard commands instead.
const PHONE_VIEWS = [
  { value: "tiers", label: "Tiers" },
  { value: "unranked", label: "Unranked" },
] as const;

const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "Up and down arrows move between players. Enter moves the player to " +
    "another tier or out of the ranking. In a tier, Alt with the up or " +
    "down arrow moves the player one place, Alt with Home or End to the " +
    "top or bottom of the tier.",
};

export function RankingEditorPage() {
  const {
    rankings,
    selectedRanking,
    selectRanking,
    isLoading: isLoadingRankings,
  } = useSelectedRanking();

  const rankingId = selectedRanking?.id;

  const detailQuery = useQuery({
    queryKey: queryKeys.rankingDetail(rankingId),
    queryFn: () => getRanking(rankingId!),
    enabled: Boolean(rankingId),
  });

  const unrankedQuery = useQuery({
    queryKey: queryKeys.rankingUnranked(rankingId),
    queryFn: () => getUnrankedPlayers(rankingId!),
    enabled: Boolean(rankingId),
  });

  const [containers, setContainers] = useState<Containers>({});
  const [isDragging, setIsDragging] = useState(false);
  const [draggingPlayerId, setDraggingPlayerId] = useState<string>();
  const [draggingPlayer, setDraggingPlayer] = useState<EditorPlayer>();
  const scrollElements = useRef(new Map<string, HTMLDivElement>());

  const registerScrollElement = useCallback(
    (id: string, node: HTMLDivElement | null) => {
      if (node) {
        scrollElements.current.set(id, node);
      } else {
        scrollElements.current.delete(id);
      }
    },
    [],
  );

  // sleeperId -> containing tier/unranked label, O(1) lookup. Recomputed
  // only when `containers` actually changes (a drop settles), not on
  // every pointer-move frame during a drag.
  const playerContainerMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const [containerId, players] of Object.entries(containers)) {
      for (const player of players) {
        map.set(player.sleeperId, containerId);
      }
    }
    return map;
  }, [containers]);

  // O(1) container lookup via playerContainerMap — called from
  // handleDragOver, which fires continuously during a drag, so a scan
  // across every player in every container is far too slow here.
  const resolveContainer = useCallback(
    (id: string): string | undefined => {
      if (id in containers) {
        return id;
      }
      return playerContainerMap.get(id);
    },
    [containers, playerContainerMap],
  );

  const { collisionDetection, lastOverId, resetLastOverId } =
    useContainerCollisionDetection(containers, playerContainerMap);

  useEdgeAutoscroll(isDragging, lastOverId, resolveContainer, scrollElements);

  const [tierDisplayMode, setTierDisplayMode] =
    useState<TierDisplayMode>("alpha");
  const [confirmingRemoveTierPosition, setConfirmingRemoveTierPosition] =
    useState<number>();
  const [positionFilter, setPositionFilter] = useState<string[]>([]);
  const [unrankedSearch, setUnrankedSearch] = useState("");
  // Separate from the unranked search on purpose: finding a player to
  // drag in shouldn't also hide the tier rows you want to drop between.
  const [rankedSearch, setRankedSearch] = useState("");
  const isPhone = useMediaQuery(PHONE_QUERY);
  // Phones show the tiers or the unranked panel, not both.
  const [phoneView, setPhoneView] =
    useState<(typeof PHONE_VIEWS)[number]["value"]>("tiers");
  const [menuPlayerId, setMenuPlayerId] = useState<string>();
  // Focus returns to the row after a menu opened from the keyboard.
  const menuOpenedByKeyboard = useRef(false);
  // The row to focus once it's (re)mounted, e.g. in the tier it moved to.
  const [focusRequestId, setFocusRequestId] = useState<string>();
  const clearFocusRequest = useCallback(() => setFocusRequestId(undefined), []);
  const [announcement, setAnnouncement] = useState("");
  // A touch drag's release can still fire a click on the row; ignore it.
  const lastDragEndAt = useRef(0);

  // Re-derive local drag state from the server whenever a *new* server
  // snapshot arrives, using React's render-time "adjusting state when a
  // prop changes" pattern instead of a useEffect: compare against the
  // last-synced references and call setState directly during render.
  // React re-renders once more before painting, so there's no visible
  // flash and no separate effect pass. Skipped entirely mid-drag so a
  // background refetch can't yank items out from under the cursor.
  // Start unsynced, not at the current data: on a return visit the
  // queries are already cached, and starting "synced" to them would
  // skip the first sync and leave `containers` empty.
  const [syncedDetail, setSyncedDetail] = useState<typeof detailQuery.data>();
  const [syncedUnranked, setSyncedUnranked] =
    useState<typeof unrankedQuery.data>();

  if (
    !isDragging &&
    detailQuery.data &&
    unrankedQuery.data &&
    (detailQuery.data !== syncedDetail || unrankedQuery.data !== syncedUnranked)
  ) {
    setSyncedDetail(detailQuery.data);
    setSyncedUnranked(unrankedQuery.data);
    setContainers(
      buildContainers(
        detailQuery.data.players,
        detailQuery.data.tiers,
        unrankedQuery.data.players,
        detailQuery.data.flags,
      ),
    );
  }

  const tiers = detailQuery.data?.tiers ?? [];
  const tierOrder = tiers.map((tier) => tier.label);

  const hasAnyRankedPlayers = Object.entries(containers).some(
    ([containerId, players]) =>
      containerId !== UNRANKED_CONTAINER && players.length > 0,
  );

  const hasOnlyOneTier = tiers.length <= 1;

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: MOUSE_DRAG_DISTANCE_PX },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: TOUCH_DRAG_DELAY_MS,
        tolerance: TOUCH_DRAG_TOLERANCE_PX,
      },
    }),
  );

  const {
    moveMutation,
    removeMutation,
    insertTierMutation,
    removeTierMutation,
    createEmptyRankingMutation,
    flagMutation,
    saveError,
  } = useRankingEditorMutations(rankingId, {
    onTierRemoved: () => setConfirmingRemoveTierPosition(undefined),
    onRankingCreated: selectRanking,
  });

  function handleRemoveTierClick(tier: RankingTierDto) {
    const playerCount = containers[tier.label]?.length ?? 0;

    if (playerCount === 0) {
      removeTierMutation.mutate({ position: tier.position });
      return;
    }

    setConfirmingRemoveTierPosition(tier.position);
  }

  function tierHeading(label: string): string {
    const tier = tiers.find((t) => t.label === label);
    return tier
      ? formatTierHeading(tier.label, tier.position, tierDisplayMode)
      : label;
  }

  function findPlayer(sleeperId: string): EditorPlayer | undefined {
    const container = resolveContainer(sleeperId);
    return container
      ? containers[container]?.find((p) => p.sleeperId === sleeperId)
      : undefined;
  }

  // Whether a player passes the position filter and a name search.
  function matchesFilters(player: EditorPlayer, search: string): boolean {
    return filterPlayers([player], positionFilter, search).length > 0;
  }

  function handleSelectPlayer(sleeperId: string) {
    if (Date.now() - lastDragEndAt.current < POST_DRAG_CLICK_GUARD_MS) {
      return;
    }
    menuOpenedByKeyboard.current = false;
    setMenuPlayerId(sleeperId);
  }

  function handleOpenMenuFromKeyboard(sleeperId: string) {
    menuOpenedByKeyboard.current = true;
    setMenuPlayerId(sleeperId);
  }

  function closeMenu(container: string) {
    const player = menuPlayerId ? findPlayer(menuPlayerId) : undefined;
    setMenuPlayerId(undefined);
    const search =
      container === UNRANKED_CONTAINER ? unrankedSearch : rankedSearch;
    if (
      menuOpenedByKeyboard.current &&
      player &&
      matchesFilters(player, search)
    ) {
      setFocusRequestId(player.sleeperId);
    }
  }

  /** Applies a move locally, saves it, and announces it. */
  function commitMove(
    working: Containers,
    sleeperId: string,
    tier: string,
    index: number,
  ) {
    setContainers(working);
    const rank = computeGlobalRank(working, tierOrder, tier, index);
    moveMutation.mutate({ sleeperId, rank, tier });
    setAnnouncement(
      `${findPlayer(sleeperId)?.fullName ?? "Player"} moved to ${tierHeading(tier)}, rank ${rank}`,
    );
  }

  function handleKeyboardMove(sleeperId: string, direction: KeyboardMove) {
    const result = stepPlayer(
      containers,
      tierOrder,
      sleeperId,
      direction,
      (player) => matchesFilters(player, rankedSearch),
    );
    if (!result) {
      return;
    }

    commitMove(result.containers, sleeperId, result.tier, result.index);
    setFocusRequestId(sleeperId);
  }

  function handleMoveToTier(sleeperId: string, tier: string) {
    closeMenu(tier);
    const fromContainer = resolveContainer(sleeperId);
    if (!fromContainer) {
      return;
    }

    const working = appendPlayerToTier(
      containers,
      sleeperId,
      fromContainer,
      tier,
    );
    commitMove(working, sleeperId, tier, working[tier].length - 1);
  }

  function handleRemoveFromRanking(sleeperId: string) {
    closeMenu(UNRANKED_CONTAINER);
    const fromContainer = resolveContainer(sleeperId);
    if (!fromContainer) {
      return;
    }

    setContainers(
      appendPlayerToTier(
        containers,
        sleeperId,
        fromContainer,
        UNRANKED_CONTAINER,
      ),
    );
    removeMutation.mutate({ sleeperId });
    setAnnouncement(
      `${findPlayer(sleeperId)?.fullName ?? "Player"} removed from the ranking`,
    );
  }

  function containerName(id: string): string {
    const container = resolveContainer(id);
    if (!container) {
      return "nowhere";
    }
    return container === UNRANKED_CONTAINER
      ? "Unranked"
      : tierHeading(container);
  }

  // Mouse/touch drag announcements by player name, not sleeperId.
  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `Picked up ${findPlayer(String(active.id))?.fullName ?? "player"}.`,
    onDragOver: ({ over }) =>
      over ? `Over ${containerName(String(over.id))}.` : undefined,
    onDragEnd: ({ active, over }) =>
      `Dropped ${findPlayer(String(active.id))?.fullName ?? "player"}${
        over ? ` in ${containerName(String(over.id))}` : ""
      }.`,
    onDragCancel: ({ active }) =>
      `Cancelled dragging ${findPlayer(String(active.id))?.fullName ?? "player"}.`,
  };

  function handleDragStart(event: DragStartEvent) {
    setIsDragging(true);
    const activeId = String(event.active.id);
    setDraggingPlayerId(activeId);
    setDraggingPlayer(findPlayer(activeId));
    resetLastOverId();
  }

  // Cross-container moves only — same-container reordering is handled
  // in handleDragEnd via arrayMove, so a background reorder doesn't
  // fight the drop-time calculation.
  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeContainer = resolveContainer(activeId);
    const overContainer = resolveContainer(overId);

    if (
      !activeContainer ||
      !overContainer ||
      activeContainer === overContainer
    ) {
      return;
    }

    setContainers((current) =>
      movePlayerToContainer(
        current,
        activeId,
        activeContainer,
        overId,
        overContainer,
      ),
    );
  }

  function clearDragState() {
    lastDragEndAt.current = Date.now();
    setIsDragging(false);
    setDraggingPlayerId(undefined);
    setDraggingPlayer(undefined);
  }

  // A drag cancelled by Escape, a window resize, or switching tabs. Undo
  // any cross-container moves it made by resyncing from the server data.
  function handleDragCancel() {
    clearDragState();
    setSyncedDetail(undefined);
  }

  function handleDragEnd(event: DragEndEvent) {
    clearDragState();

    const { active, over } = event;
    if (!over || !rankingId) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeContainer = resolveContainer(activeId);
    const finalContainer = resolveContainer(overId) ?? overId;

    if (!activeContainer) {
      return;
    }

    let working = containers;

    // Same-container reorder: onDragOver skipped this case, so resolve
    // the final in-tier order here before computing rank.
    if (
      activeContainer === finalContainer &&
      finalContainer !== UNRANKED_CONTAINER
    ) {
      const items = containers[finalContainer];
      const oldIndex = items.findIndex((p) => p.sleeperId === activeId);
      const newIndex = items.findIndex((p) => p.sleeperId === overId);

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        working = {
          ...containers,
          [finalContainer]: arrayMove(items, oldIndex, newIndex),
        };
        setContainers(working);
      }
    }

    if (finalContainer === UNRANKED_CONTAINER) {
      removeMutation.mutate({ sleeperId: activeId });
      return;
    }

    const destinationItems = working[finalContainer] ?? [];
    const indexInTier = destinationItems.findIndex(
      (player) => player.sleeperId === activeId,
    );
    const resolvedIndex =
      indexInTier === -1 ? destinationItems.length - 1 : indexInTier;

    const rank = computeGlobalRank(
      working,
      tierOrder,
      finalContainer,
      resolvedIndex,
    );

    moveMutation.mutate({ sleeperId: activeId, rank, tier: finalContainer });
  }

  const menuContainer = menuPlayerId
    ? resolveContainer(menuPlayerId)
    : undefined;
  const menuPlayer = menuPlayerId ? findPlayer(menuPlayerId) : undefined;

  if (isLoadingRankings) {
    return <p className="status-bar">Loading…</p>;
  }

  if (!rankingId) {
    return (
      <StartRankingPrompt
        isStarting={createEmptyRankingMutation.isPending}
        error={createEmptyRankingMutation.error}
        onStart={() => createEmptyRankingMutation.mutate()}
      />
    );
  }

  if (detailQuery.isLoading || unrankedQuery.isLoading) {
    return <p className="status-bar">Loading ranking…</p>;
  }

  const loadError = detailQuery.error ?? unrankedQuery.error;
  if (loadError) {
    return (
      <ErrorMessage>
        Couldn't load the ranking: {loadError.message}
      </ErrorMessage>
    );
  }

  return (
    <section className="ranking-editor">
      <EditorToolbar
        rankingId={rankingId}
        tierDisplayMode={tierDisplayMode}
        onTierDisplayModeChange={setTierDisplayMode}
      />

      {rankings && selectedRanking && (
        <div className="ranking-editor__rankings">
          <RankingSelector
            rankings={rankings}
            selectedRanking={selectedRanking}
            onSelect={selectRanking}
          />
          <button
            type="button"
            onClick={() => createEmptyRankingMutation.mutate()}
            disabled={createEmptyRankingMutation.isPending}
          >
            + New ranking
          </button>
          {createEmptyRankingMutation.isError && (
            <ErrorMessage>
              Couldn't start a new ranking:{" "}
              {createEmptyRankingMutation.error.message}
            </ErrorMessage>
          )}
        </div>
      )}

      <div className="ranking-editor__global-filters">
        <span className="ranking-editor__global-filters-label">
          Filter by position
        </span>
        <PositionFilter
          selected={positionFilter}
          onChange={setPositionFilter}
        />
        <input
          type="search"
          className="search-input ranking-editor__ranked-search"
          placeholder="Search ranked players…"
          value={rankedSearch}
          onChange={(event) => setRankedSearch(event.target.value)}
          aria-label="Search ranked players"
        />
      </div>

      {saveError && <ErrorMessage>{saveError}</ErrorMessage>}

      <EditorHints
        isPhone={isPhone}
        hasAnyRankedPlayers={hasAnyRankedPlayers}
        hasOnlyOneTier={hasOnlyOneTier}
      />

      {isPhone && (
        <SegmentedToggle
          label="Show"
          className="ranking-editor__view-toggle"
          options={PHONE_VIEWS}
          value={phoneView}
          onChange={setPhoneView}
        />
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{
          announcements,
          screenReaderInstructions: SCREEN_READER_INSTRUCTIONS,
        }}
        // Built-in autoscroll only for the page itself; the containers
        // are scrolled by useEdgeAutoscroll (see there for why).
        autoScroll={{
          canScroll: (element) =>
            element === document.scrollingElement ||
            element === document.documentElement,
        }}
      >
        <div className="ranking-editor__layout">
          {(!isPhone || phoneView === "tiers") && (
            <div className="ranking-editor__tiers">
              <AddTierButton
                disabled={insertTierMutation.isPending}
                onClick={() => insertTierMutation.mutate({ position: 1 })}
              />
              {tiers.map((tier, index) => (
                <div key={tier.label}>
                  <DroppableContainer
                    id={tier.label}
                    title={formatTierHeading(
                      tier.label,
                      tier.position,
                      tierDisplayMode,
                    )}
                    players={filterPlayers(
                      containers[tier.label] ?? [],
                      positionFilter,
                      rankedSearch,
                    )}
                    showRank
                    className="ranking-editor__tier"
                    activeId={draggingPlayerId}
                    registerScrollElement={registerScrollElement}
                    onFlagChange={(sleeperId, flag) =>
                      flagMutation.mutate({ sleeperId, flag })
                    }
                    onSelectPlayer={isPhone ? handleSelectPlayer : undefined}
                    focusRequestId={focusRequestId}
                    onRequestFocus={setFocusRequestId}
                    onFocusHandled={clearFocusRequest}
                    onOpenMenu={handleOpenMenuFromKeyboard}
                    onKeyboardMove={handleKeyboardMove}
                    removeControl={{
                      canRemove: tiers.length > 1,
                      playerCount: containers[tier.label]?.length ?? 0,
                      isLastTier: index === tiers.length - 1,
                      isConfirming:
                        confirmingRemoveTierPosition === tier.position,
                      isPending: removeTierMutation.isPending,
                      onRequestRemove: () => handleRemoveTierClick(tier),
                      onConfirmRemove: () =>
                        removeTierMutation.mutate({ position: tier.position }),
                      onCancelRemove: () =>
                        setConfirmingRemoveTierPosition(undefined),
                    }}
                  />
                  <AddTierButton
                    disabled={insertTierMutation.isPending}
                    onClick={() =>
                      insertTierMutation.mutate({ position: tier.position + 1 })
                    }
                  />
                </div>
              ))}
            </div>
          )}

          {(!isPhone || phoneView === "unranked") && (
            <aside className="ranking-editor__unranked-sticky">
              <div className="ranking-editor__unranked-search-wrap">
                <input
                  type="search"
                  className="search-input"
                  placeholder="Search unranked players…"
                  value={unrankedSearch}
                  onChange={(event) => setUnrankedSearch(event.target.value)}
                  aria-label="Search unranked players"
                />
              </div>
              <DroppableContainer
                id={UNRANKED_CONTAINER}
                title="Unranked"
                players={filterPlayers(
                  containers[UNRANKED_CONTAINER] ?? [],
                  positionFilter,
                  unrankedSearch,
                )}
                showRank={false}
                className="ranking-editor__unranked"
                activeId={draggingPlayerId}
                registerScrollElement={registerScrollElement}
                onSelectPlayer={isPhone ? handleSelectPlayer : undefined}
                focusRequestId={focusRequestId}
                onRequestFocus={setFocusRequestId}
                onFocusHandled={clearFocusRequest}
                onOpenMenu={handleOpenMenuFromKeyboard}
              />
            </aside>
          )}
        </div>

        <DragOverlay>
          {draggingPlayer ? (
            <div className="ranking-editor__drag-overlay">
              <PlayerLabel player={draggingPlayer} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {menuPlayer && menuContainer && (
        <PlayerMoveMenu
          player={menuPlayer}
          currentContainer={menuContainer}
          tiers={tiers}
          tierDisplayMode={tierDisplayMode}
          onMoveToTier={(tier) => handleMoveToTier(menuPlayer.sleeperId, tier)}
          onRemove={() => handleRemoveFromRanking(menuPlayer.sleeperId)}
          onClose={() => closeMenu(menuContainer)}
        />
      )}

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}
