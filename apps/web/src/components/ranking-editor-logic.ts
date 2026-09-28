import type { ApiPlayer, RankingPlayerDto, RankingTierDto } from "../types/api";

export const UNRANKED_CONTAINER = "unranked";

export type TierDisplayMode = "alpha" | "numeric";

/** Formats a tier's heading text per the editor's display toggle — the
 * user can view labels as their internal alphabetical form (S, A, B, ...)
 * or the equivalent numeric position (1, 2, 3, ...). Both come straight
 * from the tier data the backend already returns (`label` and
 * `position`); no new label<->number mapping is needed here — the
 * backend's S=1/A=2/... mapping (utils/tier.ts) stays backend-only. */
export function formatTierHeading(
  label: string,
  position: number,
  mode: TierDisplayMode,
): string {
  return `Tier ${mode === "numeric" ? position : label}`;
}

export interface EditorPlayer {
  sleeperId: string;
  fullName: string;
  position?: string;
  team?: string;
  injuryStatus?: string;
  /** True 1..N position across the whole ranking (not tier-local), as
   * persisted by the backend. Undefined for unranked players. Baked
   * in once per settled server sync in buildContainers — never
   * recomputed from array position, so neither filtering nor in-drag
   * reordering can change it; it only updates when a fresh,
   * server-confirmed ranking arrives after a drop settles. */
  globalRank?: number;
}

export type Containers = Record<string, EditorPlayer[]>;

function toEditorPlayer(player: ApiPlayer, globalRank?: number): EditorPlayer {
  return {
    sleeperId: player.sleeperId,
    fullName: player.fullName,
    position: player.position,
    team: player.team,
    injuryStatus: player.injuryStatus,
    globalRank,
  };
}

/** Groups the flat ranking + unranked-players response into a per-tier
 * (plus "unranked") map of editable player rows. */
export function buildContainers(
  players: RankingPlayerDto[],
  tiers: RankingTierDto[],
  unranked: ApiPlayer[],
): Containers {
  const containers: Containers = {};

  for (const tier of tiers) {
    containers[tier.label] = [];
  }

  const rankedIds = new Set<string>();

  for (const entry of players) {
    if (!entry.player) {
      continue;
    }
    const tier = entry.ranking.tier ?? tiers[0]?.label;
    if (!tier) {
      continue;
    }
    if (!containers[tier]) {
      containers[tier] = [];
    }
    containers[tier].push(toEditorPlayer(entry.player, entry.ranking.rank));
    rankedIds.add(entry.player.sleeperId);
  }

  containers[UNRANKED_CONTAINER] = unranked
    .filter((player) => !rankedIds.has(player.sleeperId))
    .map((player) => toEditorPlayer(player));

  return containers;
}

/** Moves `activeId` from `activeContainer` into `overContainer`, just
 * before `overId` if that's a player there, else at the end (dropped on
 * the container itself). Returns `containers` unchanged if the player
 * isn't in `activeContainer` — the drag-over state can lag a render
 * behind. Cross-container only; same-container reorders use arrayMove. */
export function movePlayerToContainer(
  containers: Containers,
  activeId: string,
  activeContainer: string,
  overId: string,
  overContainer: string,
): Containers {
  const sourceItems = containers[activeContainer];
  const destinationItems = containers[overContainer];

  const activeIndex = sourceItems.findIndex(
    (player) => player.sleeperId === activeId,
  );
  if (activeIndex === -1) {
    return containers;
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
    ...containers,
    [activeContainer]: newSource,
    [overContainer]: newDestination,
  };
}

/** Translates a "this player is now at position `indexInTier` within
 * `targetTier`" drop into the global (whole-ranking) rank the PATCH
 * endpoint expects, by summing the player counts of every tier that
 * sorts ahead of `targetTier`. Tiers are contiguous blocks in rank
 * order (both on import and after edits made through this endpoint),
 * so this is exact, not an approximation. */
export function computeGlobalRank(
  containers: Containers,
  tierOrder: string[],
  targetTier: string,
  indexInTier: number,
): number {
  let rank = indexInTier + 1;

  for (const label of tierOrder) {
    if (label === targetTier) {
      break;
    }
    rank += containers[label]?.length ?? 0;
  }

  return rank;
}

export const PLAYER_ROW_HEIGHT = 36;

export interface VirtualRow {
  index: number;
  start: number;
}

/**
 * Merges the virtualizer's visible-range rows with the currently
 * dragged item's row, if that item belongs to this container but has
 * scrolled outside the visible window. Without this, a long drag (top
 * of a 180-player tier to the bottom) would unmount the dragged node
 * mid-drag once it scrolls out of view, breaking the drag — dnd-kit
 * moves the dragged node via a CSS transform on its own mounted DOM
 * node, not a floating overlay, so that node must stay mounted for the
 * whole drag.
 */
export function withForcedActiveRow(
  visibleRows: VirtualRow[],
  players: { sleeperId: string }[],
  activeId: string | undefined,
): VirtualRow[] {
  if (!activeId) {
    return visibleRows;
  }

  if (visibleRows.some((row) => players[row.index]?.sleeperId === activeId)) {
    return visibleRows;
  }

  const activeIndex = players.findIndex(
    (player) => player.sleeperId === activeId,
  );

  if (activeIndex === -1) {
    return visibleRows;
  }

  return [
    ...visibleRows,
    { index: activeIndex, start: activeIndex * PLAYER_ROW_HEIGHT },
  ].sort((a, b) => a.index - b.index);
}

/** Position allow-list filter, usable on any container (tiers or
 * unranked). Returns the same array reference when no filter is
 * active, so it's a free no-op — important because tier/unranked
 * arrays are recomputed on every render and this must not reintroduce
 * per-frame cost during drags. */
export function filterPlayersByPosition(
  players: EditorPlayer[],
  positions: string[],
): EditorPlayer[] {
  if (positions.length === 0) {
    return players;
  }

  return players.filter(
    (player) =>
      player.position !== undefined && positions.includes(player.position),
  );
}

/** Case-insensitive name/team substring search, for the tiers and the
 * unranked panel (each with its own query). Same no-op-when-empty
 * behavior as above. */
export function filterPlayersByQuery(
  players: EditorPlayer[],
  query: string,
): EditorPlayer[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (normalizedQuery === "") {
    return players;
  }

  return players.filter((player) => {
    const haystack = `${player.fullName} ${player.team ?? ""}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
