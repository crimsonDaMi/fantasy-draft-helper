import type { PlayerFlag, RankingDetailResponse } from "../types/api";
import { formatPositionRank } from "./position-rank";

export interface PrintRow {
  rank: number;
  name: string;
  team?: string;
  /** Position and positional rank, e.g. `WR12`. */
  position?: string;
  bye?: number;
  flag?: PlayerFlag;
  note?: string;
}

export interface PrintTier {
  /** Undefined when the ranking has no tiers. */
  label?: string;
  rows: PrintRow[];
}

/** The ranking as cheat-sheet rows grouped by tier, in ranking order.
 * Unmatched import rows keep their place with their CSV name, position
 * and team, and count toward positional ranks like on draft day. */
export function buildPrintTiers(detail: RankingDetailResponse): PrintTier[] {
  const tiers = [...detail.tiers].sort((a, b) => a.position - b.position);
  const groups = new Map<string | undefined, PrintRow[]>(
    tiers.map((tier) => [tier.label, []]),
  );
  const positionCounts = new Map<string, number>();
  const entries = [...detail.players].sort(
    (a, b) => a.ranking.rank - b.ranking.rank,
  );

  for (const { ranking, player } of entries) {
    const position = player?.position ?? ranking.position;
    let positionRank: number | undefined;
    if (position) {
      positionRank = (positionCounts.get(position) ?? 0) + 1;
      positionCounts.set(position, positionRank);
    }

    const label = ranking.tier ?? tiers[0]?.label;
    let rows = groups.get(label);
    if (!rows) {
      rows = [];
      groups.set(label, rows);
    }
    rows.push({
      rank: ranking.rank,
      name: player?.fullName ?? ranking.playerName,
      team: player?.team ?? ranking.team,
      position: formatPositionRank(position, positionRank),
      bye: ranking.bye,
      flag: player ? detail.flags[player.sleeperId] : undefined,
      note: ranking.note,
    });
  }

  return [...groups]
    .filter(([, rows]) => rows.length > 0)
    .map(([label, rows]) => ({ label, rows }));
}
