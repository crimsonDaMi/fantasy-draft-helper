import { useCallback, useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";

import {
  getRanking,
  getRankingsStatus,
  getUnrankedPlayers,
  insertTier,
  moveRankingPlayer,
  removeRankingPlayer,
  removeTier,
} from "../api/fantasy-api";
import type { RankingTierDto } from "../types/api";
import {
  UNRANKED_CONTAINER,
  buildContainers,
  computeGlobalRank,
  formatTierHeading,
  withForcedActiveRow,
  PLAYER_ROW_HEIGHT,
  type Containers,
  type EditorPlayer,
  type TierDisplayMode,
} from "./ranking-editor-logic";

interface SortablePlayerProps {
  player: EditorPlayer;
  rank?: number;
  offsetTop: number;
}

function SortablePlayer({ player, rank, offsetTop }: SortablePlayerProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.sleeperId });

  const style: React.CSSProperties = {
    position: "absolute",
    top: offsetTop,
    left: 0,
    right: 0,
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    touchAction: "none",
  };

  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {rank !== undefined && (
        <span className="ranking-editor__rank">#{rank}</span>
      )}
      <span className="ranking-editor__name">{player.fullName}</span>
      <span className="ranking-editor__meta">
        {player.position}
        {player.position && player.team && " · "}
        {player.team}
      </span>
    </li>
  );
}

interface TierRemoveControl {
  canRemove: boolean;
  isConfirming: boolean;
  isPending: boolean;
  onRequestRemove: () => void;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
}

interface DroppableContainerProps {
  id: string;
  title: string;
  players: EditorPlayer[];
  showRank: boolean;
  className: string;
  removeControl?: TierRemoveControl;
  activeId?: string;
}

function DroppableContainer({
  id,
  title,
  players,
  showRank,
  className,
  removeControl,
  activeId,
}: DroppableContainerProps) {
  const { setNodeRef } = useDroppable({ id });
  const scrollElementRef = useRef<HTMLDivElement>(null);

  const setScrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollElementRef.current = node;
      setNodeRef(node);
    },
    [setNodeRef],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-virtual's API is inherently incompatible with React Compiler memoization; harmless since Compiler isn't enabled in this project.
  const virtualizer = useVirtualizer({
    count: players.length,
    getScrollElement: () => scrollElementRef.current,
    estimateSize: () => PLAYER_ROW_HEIGHT,
    overscan: 8,
  });

  const virtualRows = withForcedActiveRow(
    virtualizer.getVirtualItems(),
    players,
    activeId,
  );

  return (
    <div className={className}>
      <div className="ranking-editor__tier-header">
        <h3>{title}</h3>
        {removeControl?.canRemove &&
          (removeControl.isConfirming ? (
            <span className="ranking-editor__tier-confirm">
              <span>Merge {players.length} player(s) into the next tier?</span>
              <button
                type="button"
                onClick={removeControl.onConfirmRemove}
                disabled={removeControl.isPending}
              >
                Confirm
              </button>
              <button type="button" onClick={removeControl.onCancelRemove}>
                Cancel
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="ranking-editor__tier-remove"
              onClick={removeControl.onRequestRemove}
            >
              Remove tier
            </button>
          ))}
      </div>
      <SortableContext
        items={players.map((player) => player.sleeperId)}
        strategy={verticalListSortingStrategy}
      >
        <div ref={setScrollRef} className="ranking-editor__player-list">
          <ol
            className="ranking-editor__player-list-inner"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualRows.map((virtualRow) => {
              const player = players[virtualRow.index];
              if (!player) {
                return null;
              }
              return (
                <SortablePlayer
                  key={player.sleeperId}
                  player={player}
                  rank={showRank ? virtualRow.index + 1 : undefined}
                  offsetTop={virtualRow.start}
                />
              );
            })}
          </ol>
        </div>
      </SortableContext>
    </div>
  );
}

export function RankingEditorPage() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["ranking-status"],
    queryFn: getRankingsStatus,
  });

  const rankingId = statusQuery.data?.rankingId;

  const detailQuery = useQuery({
    queryKey: ["ranking-detail", rankingId],
    queryFn: () => getRanking(rankingId!),
    enabled: Boolean(rankingId),
  });

  const unrankedQuery = useQuery({
    queryKey: ["ranking-unranked", rankingId],
    queryFn: () => getUnrankedPlayers(rankingId!),
    enabled: Boolean(rankingId),
  });

  const [containers, setContainers] = useState<Containers>({});
  const [isDragging, setIsDragging] = useState(false);
  const lastOverId = useRef<string | null>(null);
  const [draggingPlayerId, setDraggingPlayerId] = useState<string>();

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

  // O(1) replacement for the ranking-editor-logic.ts findContainer()
  // helper, which does a full Object.keys(containers).find(...).some(...)
  // scan across every player in every container. That's cheap enough for
  // one-off calls (still used in tests / handleDragEnd's first lookup
  // pattern elsewhere) but far too slow to call from handleDragOver,
  // which fires continuously during a drag.
  const resolveContainer = useCallback(
    (id: string): string | undefined => {
      if (id in containers) {
        return id;
      }
      return playerContainerMap.get(id);
    },
    [containers, playerContainerMap],
  );

  const [tierDisplayMode, setTierDisplayMode] =
    useState<TierDisplayMode>("alpha");
  const [confirmingRemoveTierPosition, setConfirmingRemoveTierPosition] =
    useState<number>();

  // Re-derive local drag state from the server whenever a *new* server
  // snapshot arrives, using React's render-time "adjusting state when a
  // prop changes" pattern instead of a useEffect: compare against the
  // last-synced references and call setState directly during render.
  // React re-renders once more before painting, so there's no visible
  // flash and no separate effect pass. Skipped entirely mid-drag so a
  // background refetch can't yank items out from under the cursor.
  const [syncedDetail, setSyncedDetail] = useState(detailQuery.data);
  const [syncedUnranked, setSyncedUnranked] = useState(unrankedQuery.data);

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
      ),
    );
  }

  const tiers = detailQuery.data?.tiers ?? [];

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
  );

  // ~360 sortable player rows makes the default collision detection
  // (comparing every row on every pointer-move) expensive enough to
  // visibly stall drags. Use the cheap pointerWithin check to find
  // which tier/unranked container the pointer is over first, then run
  // the more expensive closestCenter only against that container's
  // rows — the standard dnd-kit pattern for large multi-container
  // sortable lists.
  const collisionDetectionStrategy: CollisionDetection = useCallback(
    (args) => {
      const pointerIntersections = pointerWithin(args);
      const intersections =
        pointerIntersections.length > 0
          ? pointerIntersections
          : rectIntersection(args);
      let overId = getFirstCollision(intersections, "id");

      if (overId != null) {
        const overIdStr = String(overId);
        const targetContainer = playerContainerMap.get(overIdStr) ?? overIdStr;

        if (containers[targetContainer]?.length) {
          const closest = closestCenter({
            ...args,
            droppableContainers: args.droppableContainers.filter(
              (container) =>
                playerContainerMap.get(String(container.id)) ===
                  targetContainer || container.id === targetContainer,
            ),
          });
          overId = closest[0]?.id ?? overId;
        }

        lastOverId.current = String(overId);
        return [{ id: overId }];
      }

      return lastOverId.current ? [{ id: lastOverId.current }] : [];
    },
    [containers, playerContainerMap],
  );

  function settleQueries() {
    void queryClient.invalidateQueries({
      queryKey: ["ranking-detail", rankingId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["ranking-unranked", rankingId],
    });
  }

  function settleTierQueries() {
    // Tier boundary changes only shift tier labels/assignments within
    // the existing ranking — the unranked pool is untouched, so only
    // ranking-detail needs to reconcile.
    void queryClient.invalidateQueries({
      queryKey: ["ranking-detail", rankingId],
    });
  }

  const moveMutation = useMutation({
    mutationFn: ({
      sleeperId,
      rank,
      tier,
    }: {
      sleeperId: string;
      rank: number;
      tier: string;
    }) => moveRankingPlayer(rankingId!, sleeperId, rank, tier),
    onSettled: settleQueries,
  });

  const removeMutation = useMutation({
    mutationFn: ({ sleeperId }: { sleeperId: string }) =>
      removeRankingPlayer(rankingId!, sleeperId),
    onSettled: settleQueries,
  });

  const insertTierMutation = useMutation({
    mutationFn: ({ position }: { position: number }) =>
      insertTier(rankingId!, position),
    onSettled: settleTierQueries,
  });

  const removeTierMutation = useMutation({
    mutationFn: ({ position }: { position: number }) =>
      removeTier(rankingId!, position),
    onSuccess: () => setConfirmingRemoveTierPosition(undefined),
    onSettled: settleTierQueries,
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
    setDraggingPlayerId(String(event.active.id));
    lastOverId.current = null;
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

    setContainers((current) => {
      const sourceItems = current[activeContainer];
      const destinationItems = current[overContainer];

      const activeIndex = sourceItems.findIndex(
        (player) => player.sleeperId === activeId,
      );
      if (activeIndex === -1) {
        return current;
      }

      const overIndex = destinationItems.findIndex(
        (player) => player.sleeperId === overId,
      );

      const moving = sourceItems[activeIndex];
      const newSource = [...sourceItems];
      newSource.splice(activeIndex, 1);

      const insertAt = overIndex === -1 ? destinationItems.length : overIndex;
      const newDestination = [...destinationItems];
      newDestination.splice(insertAt, 0, moving);

      return {
        ...current,
        [activeContainer]: newSource,
        [overContainer]: newDestination,
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setIsDragging(false);
    setDraggingPlayerId(undefined);

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

  if (statusQuery.isLoading) {
    return <p className="status-bar">Loading…</p>;
  }

  if (!rankingId) {
    return (
      <section className="ranking-editor">
        <h2>Edit rankings</h2>
        <p>
          Import a ranking on the Draft tab first, then come back here to edit
          it.
        </p>
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
        <div
          className="ranking-editor__tier-mode-toggle"
          role="group"
          aria-label="Tier label format"
        >
          <button
            type="button"
            className={
              tierDisplayMode === "alpha"
                ? "ranking-editor__mode-button ranking-editor__mode-button--active"
                : "ranking-editor__mode-button"
            }
            onClick={() => setTierDisplayMode("alpha")}
          >
            Letters
          </button>
          <button
            type="button"
            className={
              tierDisplayMode === "numeric"
                ? "ranking-editor__mode-button ranking-editor__mode-button--active"
                : "ranking-editor__mode-button"
            }
            onClick={() => setTierDisplayMode("numeric")}
          >
            Numbers
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
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
            {tiers.map((tier) => (
              <div key={tier.label}>
                <DroppableContainer
                  id={tier.label}
                  title={formatTierHeading(
                    tier.label,
                    tier.position,
                    tierDisplayMode,
                  )}
                  players={containers[tier.label] ?? []}
                  showRank
                  className="ranking-editor__tier"
                  activeId={draggingPlayerId}
                  removeControl={{
                    canRemove: tiers.length > 1,
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

          <aside>
            <DroppableContainer
              id={UNRANKED_CONTAINER}
              title="Unranked"
              players={containers[UNRANKED_CONTAINER] ?? []}
              showRank={false}
              className="ranking-editor__unranked"
              activeId={draggingPlayerId}
            />
          </aside>
        </div>
      </DndContext>
    </section>
  );
}
