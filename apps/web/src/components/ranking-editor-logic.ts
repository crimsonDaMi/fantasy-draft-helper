import type {
  ApiPlayer,
  PlayerFlag,
  RankingPlayerDto,
  RankingTierDto,
} from "../types/api";

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
  /** Watch/avoid flag, baked in on each server sync like `globalRank`.
   * Ranked players only. */
  flag?: PlayerFlag;
}

export type Containers = Record<string, EditorPlayer[]>;

function toEditorPlayer(
  player: ApiPlayer,
  globalRank?: number,
  flag?: PlayerFlag,
): EditorPlayer {
  return {
    sleeperId: player.sleeperId,
    fullName: player.fullName,
    position: player.position,
    team: player.team,
    injuryStatus: player.injuryStatus,
    globalRank,
    flag,
  };
}

/** Groups the flat ranking + unranked-players response into a per-tier
 * (plus "unranked") map of editable player rows. */
export function buildContainers(
  players: RankingPlayerDto[],
  tiers: RankingTierDto[],
  unranked: ApiPlayer[],
  flags: Record<string, PlayerFlag> = {},
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
    containers[tier].push(
      toEditorPlayer(
        entry.player,
        entry.ranking.rank,
        flags[entry.player.sleeperId],
      ),
    );
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

/** Moves a player to the end of `toTier` — the phone move menu's "Move to
 * tier". Unlike `movePlayerToContainer`, the source and target may be the
 * same container (moves the player to the end of their own tier). Returns
 * `containers` unchanged when the player isn't in `fromContainer`. */
export function appendPlayerToTier(
  containers: Containers,
  sleeperId: string,
  fromContainer: string,
  toTier: string,
): Containers {
  const source = containers[fromContainer] ?? [];
  const moving = source.find((player) => player.sleeperId === sleeperId);
  if (!moving) {
    return containers;
  }

  const withoutPlayer = {
    ...containers,
    [fromContainer]: source.filter((player) => player !== moving),
  };
  return {
    ...withoutPlayer,
    [toTier]: [...(withoutPlayer[toTier] ?? []), moving],
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
 * Merges the virtualizer's visible-range rows with the rows of
 * `keepIds` — the dragged player and the keyboard-focused one — when
 * they belong to this container but have scrolled outside the visible
 * window. Without this, a long drag (top of a 180-player tier to the
 * bottom) would unmount the dragged node mid-drag once it scrolls out
 * of view, breaking the drag — dnd-kit moves the dragged node via a CSS
 * transform on its own mounted DOM node, not a floating overlay, so
 * that node must stay mounted for the whole drag. Likewise a focused
 * row that unmounts drops keyboard focus to the page.
 */
export function withForcedRows(
  visibleRows: VirtualRow[],
  players: { sleeperId: string }[],
  keepIds: (string | undefined)[],
): VirtualRow[] {
  let rows = visibleRows;

  for (const keepId of keepIds) {
    if (
      !keepId ||
      rows.some((row) => players[row.index]?.sleeperId === keepId)
    ) {
      continue;
    }

    const keepIndex = players.findIndex(
      (player) => player.sleeperId === keepId,
    );

    if (keepIndex === -1) {
      continue;
    }

    rows = [
      ...rows,
      { index: keepIndex, start: keepIndex * PLAYER_ROW_HEIGHT },
    ].sort((a, b) => a.index - b.index);
  }

  return rows;
}

export type KeyboardMove = "up" | "down" | "top" | "bottom";

export interface KeyboardMoveResult {
  containers: Containers;
  tier: string;
  index: number;
}

/** The keyboard alternative to dragging a ranked player: one visible slot
 * up or down — crossing into the end of the tier above or the start of
 * the tier below at a tier edge — or to the top or bottom of their tier.
 * `isVisible` is the active filter: under a filter a slot is a *visible*
 * row, as with a mouse drop, so hidden rows are stepped over. Returns
 * `null` when the player isn't ranked or can't move any further. */
export function stepPlayer(
  containers: Containers,
  tierOrder: string[],
  sleeperId: string,
  direction: KeyboardMove,
  isVisible: (player: EditorPlayer) => boolean = () => true,
): KeyboardMoveResult | null {
  const tierIndex = tierOrder.findIndex((label) =>
    containers[label]?.some((player) => player.sleeperId === sleeperId),
  );
  if (tierIndex === -1) {
    return null;
  }

  const tier = tierOrder[tierIndex];
  const source = containers[tier];
  const fromIndex = source.findIndex(
    (player) => player.sleeperId === sleeperId,
  );
  const moving = source[fromIndex];
  const rest = source.filter((player) => player !== moving);

  const placeIn = (targetTier: string, index: number): KeyboardMoveResult => {
    const target =
      targetTier === tier ? rest : [...(containers[targetTier] ?? [])];
    const updated = [...target];
    updated.splice(index, 0, moving);
    return {
      containers: {
        ...containers,
        [tier]: rest,
        [targetTier]: updated,
      },
      tier: targetTier,
      index,
    };
  };

  switch (direction) {
    case "top":
      return fromIndex === 0 ? null : placeIn(tier, 0);
    case "bottom":
      return fromIndex === source.length - 1
        ? null
        : placeIn(tier, rest.length);
    case "up": {
      const above = source.slice(0, fromIndex).findLast(isVisible);
      if (above) {
        return placeIn(tier, rest.indexOf(above));
      }
      const previousTier = tierOrder[tierIndex - 1];
      return previousTier === undefined
        ? null
        : placeIn(previousTier, containers[previousTier]?.length ?? 0);
    }
    case "down": {
      const below = source.slice(fromIndex + 1).find(isVisible);
      if (below) {
        return placeIn(tier, rest.indexOf(below) + 1);
      }
      const nextTier = tierOrder[tierIndex + 1];
      return nextTier === undefined ? null : placeIn(nextTier, 0);
    }
  }
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
