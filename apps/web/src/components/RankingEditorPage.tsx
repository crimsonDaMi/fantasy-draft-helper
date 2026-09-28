import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useQuery } from "@tanstack/react-query";

import {
  getRanking,
  getUnrankedPlayers,
  rankingExportUrl,
} from "../api/fantasy-api";
import { queryKeys } from "../api/query-keys";
import { useContainerCollisionDetection } from "../hooks/useContainerCollisionDetection";
import { useEdgeAutoscroll } from "../hooks/useEdgeAutoscroll";
import { useRankingEditorMutations } from "../hooks/useRankingEditorMutations";
import { useSelectedRanking } from "../hooks/useSelectedRanking";
import type { RankingTierDto } from "../types/api";
import { PositionFilter } from "./PositionFilter";
import { RankingSelector } from "./RankingSelector";
import { DroppableContainer } from "./ranking-editor/DroppableContainer";
import { PlayerLabel } from "./ranking-editor/PlayerLabel";
import { TierModeToggle } from "./ranking-editor/TierModeToggle";
import {
  UNRANKED_CONTAINER,
  buildContainers,
  computeGlobalRank,
  filterPlayersByPosition,
  filterPlayersByQuery,
  formatTierHeading,
  movePlayerToContainer,
  type Containers,
  type EditorPlayer,
  type TierDisplayMode,
} from "./ranking-editor-logic";

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

  const hasAnyRankedPlayers = Object.entries(containers).some(
    ([containerId, players]) =>
      containerId !== UNRANKED_CONTAINER && players.length > 0,
  );

  const hasOnlyOneTier = tiers.length <= 1;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

  const {
    moveMutation,
    removeMutation,
    insertTierMutation,
    removeTierMutation,
    createEmptyRankingMutation,
    flagMutation,
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

  function handleDragStart(event: DragStartEvent) {
    setIsDragging(true);
    const activeId = String(event.active.id);
    setDraggingPlayerId(activeId);
    const container = resolveContainer(activeId);
    setDraggingPlayer(
      container
        ? containers[container]?.find((p) => p.sleeperId === activeId)
        : undefined,
    );
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

  function handleDragEnd(event: DragEndEvent) {
    setIsDragging(false);
    setDraggingPlayerId(undefined);
    setDraggingPlayer(undefined);

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
      tiers.map((tier) => tier.label),
      finalContainer,
      resolvedIndex,
    );

    moveMutation.mutate({ sleeperId: activeId, rank, tier: finalContainer });
  }

  if (isLoadingRankings) {
    return <p className="status-bar">Loading…</p>;
  }

  if (!rankingId) {
    return (
      <section className="ranking-editor">
        <h2>Edit rankings</h2>
        <p>
          Import a ranking on the Draft tab, or start a new one here and build
          it from scratch.
        </p>
        <button
          type="button"
          className="ranking-editor__start-new"
          onClick={() => createEmptyRankingMutation.mutate()}
          disabled={createEmptyRankingMutation.isPending}
        >
          {createEmptyRankingMutation.isPending
            ? "Starting…"
            : "Start a new ranking"}
        </button>
        {createEmptyRankingMutation.isError && (
          <p className="status-bar status-bar__error">
            Failed to start a new ranking. Try again.
          </p>
        )}
      </section>
    );
  }

  if (detailQuery.isLoading || unrankedQuery.isLoading) {
    return <p className="status-bar">Loading ranking…</p>;
  }

  if (detailQuery.error || unrankedQuery.error) {
    return (
      <p className="status-bar status-bar__error">
        Failed to load the ranking.
      </p>
    );
  }

  return (
    <section className="ranking-editor">
      <div className="ranking-editor__toolbar">
        <h2>Edit rankings</h2>
        <div className="ranking-editor__toolbar-actions">
          <a
            className="ranking-editor__mode-button ranking-editor__export-link"
            href={rankingExportUrl(rankingId)}
            download
          >
            Export CSV
          </a>
          <TierModeToggle
            value={tierDisplayMode}
            onChange={setTierDisplayMode}
          />
        </div>
      </div>

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
            <p className="status-bar status-bar__error">
              {createEmptyRankingMutation.error.message}
            </p>
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

      {(!hasAnyRankedPlayers || hasOnlyOneTier) && (
        <div className="ranking-editor__hints">
          {!hasAnyRankedPlayers && (
            <p className="ranking-editor__hint">
              Drag players from the Unranked panel into a tier to start ranking
              them.
            </p>
          )}
          {hasOnlyOneTier && (
            <p className="ranking-editor__hint">
              Use "+ Add tier here" to create more tiers.
            </p>
          )}
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        // Built-in autoscroll only for the page itself; the containers
        // are scrolled by useEdgeAutoscroll (see there for why).
        autoScroll={{
          canScroll: (element) =>
            element === document.scrollingElement ||
            element === document.documentElement,
        }}
      >
        <div className="ranking-editor__layout">
          <div className="ranking-editor__tiers">
            <button
              type="button"
              className="ranking-editor__tier-add"
              onClick={() => insertTierMutation.mutate({ position: 1 })}
              disabled={insertTierMutation.isPending}
            >
              + Add tier here
            </button>
            {tiers.map((tier, index) => (
              <div key={tier.label}>
                <DroppableContainer
                  id={tier.label}
                  title={formatTierHeading(
                    tier.label,
                    tier.position,
                    tierDisplayMode,
                  )}
                  players={filterPlayersByQuery(
                    filterPlayersByPosition(
                      containers[tier.label] ?? [],
                      positionFilter,
                    ),
                    rankedSearch,
                  )}
                  showRank
                  className="ranking-editor__tier"
                  activeId={draggingPlayerId}
                  registerScrollElement={registerScrollElement}
                  onFlagChange={(sleeperId, flag) =>
                    flagMutation.mutate({ sleeperId, flag })
                  }
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
                <button
                  type="button"
                  className="ranking-editor__tier-add"
                  onClick={() =>
                    insertTierMutation.mutate({ position: tier.position + 1 })
                  }
                  disabled={insertTierMutation.isPending}
                >
                  + Add tier here
                </button>
              </div>
            ))}
          </div>

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
              players={filterPlayersByQuery(
                filterPlayersByPosition(
                  containers[UNRANKED_CONTAINER] ?? [],
                  positionFilter,
                ),
                unrankedSearch,
              )}
              showRank={false}
              className="ranking-editor__unranked"
              activeId={draggingPlayerId}
              registerScrollElement={registerScrollElement}
            />
          </aside>
        </div>

        <DragOverlay>
          {draggingPlayer ? (
            <div className="ranking-editor__drag-overlay">
              <PlayerLabel player={draggingPlayer} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </section>
  );
}
