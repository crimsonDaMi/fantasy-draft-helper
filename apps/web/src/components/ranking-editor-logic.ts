import type { ApiPlayer, RankingPlayerDto, RankingTierDto } from "../types/api";

export const UNRANKED_CONTAINER = "unranked";

export interface EditorPlayer {
  sleeperId: string;
  fullName: string;
  position?: string;
  team?: string;
}

export type Containers = Record<string, EditorPlayer[]>;

function toEditorPlayer(player: ApiPlayer): EditorPlayer {
  return {
    sleeperId: player.sleeperId,
    fullName: player.fullName,
    position: player.position,
    team: player.team,
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
    containers[tier].push(toEditorPlayer(entry.player));
  }

  containers[UNRANKED_CONTAINER] = unranked.map(toEditorPlayer);

  return containers;
}

/** Which container (tier label or "unranked") an id belongs to. `id`
 * may be a container id itself (dropped on an empty container) or a
 * player's sleeperId. */
export function findContainer(
  containers: Containers,
  id: string,
): string | undefined {
  if (id in containers) {
    return id;
  }

  return Object.keys(containers).find((key) =>
    containers[key].some((player) => player.sleeperId === id),
  );
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
