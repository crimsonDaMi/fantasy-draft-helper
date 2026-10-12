import type { ApiDraftPick } from "../types/api";
import { starterIndexes } from "./roster-fill";

export interface ByeClash {
  week: number;
  players: string[];
}

/** Weeks in which two or more of the user's starters are on bye, by
 * week. Picks without a bye week (none in the ranking CSV) never clash. */
export function byeClashes(
  myPicks: ApiDraftPick[],
  rosterSlots: Record<string, number>,
): ByeClash[] {
  const starters = starterIndexes(
    myPicks.map((pick) => pick.position),
    rosterSlots,
  );
  const byWeek = new Map<number, string[]>();

  myPicks.forEach((pick, index) => {
    if (pick.bye === undefined || !starters.has(index)) {
      return;
    }

    byWeek.set(pick.bye, [
      ...(byWeek.get(pick.bye) ?? []),
      pick.playerName ?? pick.playerId,
    ]);
  });

  return [...byWeek]
    .filter(([, players]) => players.length > 1)
    .sort(([a], [b]) => a - b)
    .map(([week, players]) => ({ week, players }));
}
