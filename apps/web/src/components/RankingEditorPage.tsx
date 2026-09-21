import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getRanking,
  getRankingsStatus,
  getUnrankedPlayers,
  moveRankingPlayer,
  removeRankingPlayer,
} from "../api/fantasy-api";
import {
  UNRANKED_CONTAINER,
  buildContainers,
  computeGlobalRank,
  findContainer,
  type Containers,
  type EditorPlayer,
} from "./ranking-editor-logic";

interface SortablePlayerProps {
  player: EditorPlayer;
  rank?: number;
}

function SortablePlayer({ player, rank }: SortablePlayerProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.sleeperId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
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

interface DroppableContainerProps {
  id: string;
  title: string;
  players: EditorPlayer[];
  showRank: boolean;
  className: string;
}

function DroppableContainer({
  id,
  title,
  players,
  showRank,
  className,
}: DroppableContainerProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className={className}>
      <h3>{title}</h3>
      <SortableContext
        items={players.map((player) => player.sleeperId)}
        strategy={verticalListSortingStrategy}
      >
        <ol className="ranking-editor__player-list" ref={setNodeRef}>
          {players.map((player, index) => (
            <SortablePlayer
              key={player.sleeperId}
              player={player}
              rank={showRank ? index + 1 : undefined}
            />
          ))}
        </ol>
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

  function settleQueries() {
    void queryClient.invalidateQueries({
      queryKey: ["ranking-detail", rankingId],
    });
    void queryClient.invalidateQueries({
      queryKey: ["ranking-unranked", rankingId],
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

  function handleDragStart() {
    setIsDragging(true);
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

    const activeContainer = findContainer(containers, activeId);
    const overContainer = findContainer(containers, overId);

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

    const { active, over } = event;
    if (!over || !rankingId) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeContainer = findContainer(containers, activeId);
    const finalContainer = findContainer(containers, overId) ?? overId;

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
      <h2>Edit rankings</h2>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="ranking-editor__layout">
          <div className="ranking-editor__tiers">
            {tiers.map((tier) => (
              <DroppableContainer
                key={tier.label}
                id={tier.label}
                title={`Tier ${tier.label}`}
                players={containers[tier.label] ?? []}
                showRank
                className="ranking-editor__tier"
              />
            ))}
          </div>

          <aside>
            <DroppableContainer
              id={UNRANKED_CONTAINER}
              title="Unranked"
              players={containers[UNRANKED_CONTAINER] ?? []}
              showRank={false}
              className="ranking-editor__unranked"
            />
          </aside>
        </div>
      </DndContext>
    </section>
  );
}
