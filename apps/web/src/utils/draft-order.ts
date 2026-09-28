import type { ApiDraftInfo, ApiDraftPick } from "../types/api";

/** Draft slot (1-based) that owns a given overall pick. Linear drafts
 * repeat the same order every round; snake drafts reverse every other
 * round, and with a reversal round (third-round reversal) the direction
 * flips once more from that round on. Traded picks aren't reflected. */
export function slotForPick(
  pickNo: number,
  teams: number,
  type: string | undefined,
  reversalRound?: number,
): number {
  const round = Math.ceil(pickNo / teams);
  const indexInRound = (pickNo - 1) % teams;

  if (type === "linear") {
    return indexInRound + 1;
  }

  let reversed = round % 2 === 0;

  if (reversalRound !== undefined && round >= reversalRound) {
    reversed = !reversed;
  }

  return reversed ? teams - indexInRound : indexInRound + 1;
}

export interface NextPick {
  pickNo: number;
  round: number;
  pickInRound: number;
  /** 0 when the slot is on the clock. */
  picksUntil: number;
}

/** The slot's next pick at or after `currentPickNo`, or undefined when
 * it has none left (or the draft has no pick order, e.g. auctions). */
export function nextPickFor(
  slot: number,
  currentPickNo: number,
  draft: ApiDraftInfo,
): NextPick | undefined {
  const { teams, rounds, type, reversalRound } = draft;

  if (!teams || type === "auction") {
    return undefined;
  }

  const lastPickNo = rounds ? teams * rounds : currentPickNo + 2 * teams;

  for (let pickNo = currentPickNo; pickNo <= lastPickNo; pickNo++) {
    if (slotForPick(pickNo, teams, type, reversalRound) === slot) {
      return {
        pickNo,
        round: Math.ceil(pickNo / teams),
        pickInRound: ((pickNo - 1) % teams) + 1,
        picksUntil: pickNo - currentPickNo,
      };
    }
  }

  return undefined;
}

/** Overall number of the pick currently on the clock. */
export function currentPickNo(picks: ApiDraftPick[]): number {
  return picks.reduce((highest, pick) => Math.max(highest, pick.pickNo), 0) + 1;
}

/** The picks made by the given slot — by Sleeper user when known, so a
 * pick made on a traded draft position still counts as the user's. */
export function picksForSlot(
  picks: ApiDraftPick[],
  slot: number,
  sleeperUserId?: string,
): ApiDraftPick[] {
  return picks.filter((pick) =>
    sleeperUserId !== undefined && pick.pickedBy !== undefined
      ? pick.pickedBy === sleeperUserId
      : pick.draftSlot === slot,
  );
}

const FLEX_SLOTS: { slot: string; positions: string[] }[] = [
  // Most restrictive first, so a player isn't spent on a wider flex slot
  // that someone else could have filled.
  { slot: "WRRB_FLEX", positions: ["RB", "WR"] },
  { slot: "REC_FLEX", positions: ["WR", "TE"] },
  { slot: "FLEX", positions: ["RB", "WR", "TE"] },
  { slot: "SUPER_FLEX", positions: ["QB", "RB", "WR", "TE"] },
];

const STARTER_SLOTS = ["QB", "RB", "WR", "TE", "K", "DEF"];

export const ROSTER_SLOT_LABELS: Record<string, string> = {
  WRRB_FLEX: "W/R",
  REC_FLEX: "W/T",
  FLEX: "FLEX",
  SUPER_FLEX: "SF",
  BN: "BN",
};

export interface RosterSlotFill {
  slot: string;
  filled: number;
  required: number;
}

/** How the drafted positions fill the league's lineup, greedily: exact
 * positions first, then flex slots, then the bench. Display only — it
 * describes the roster, it doesn't suggest what to draft. */
export function fillRoster(
  positions: (string | undefined)[],
  rosterSlots: Record<string, number>,
): RosterSlotFill[] {
  const remaining = positions.filter(
    (position): position is string => position !== undefined,
  );
  const fills: RosterSlotFill[] = [];

  function take(slot: string, accepts: string[]) {
    const required = rosterSlots[slot] ?? 0;

    if (required === 0) {
      return;
    }

    let filled = 0;

    while (filled < required) {
      const index = remaining.findIndex((position) =>
        accepts.includes(position),
      );

      if (index === -1) {
        break;
      }

      remaining.splice(index, 1);
      filled++;
    }

    fills.push({ slot, filled, required });
  }

  for (const slot of STARTER_SLOTS) {
    take(slot, [slot]);
  }

  for (const { slot, positions: accepts } of FLEX_SLOTS) {
    take(slot, accepts);
  }

  if (remaining.length > 0 || rosterSlots.BN) {
    fills.push({
      slot: "BN",
      filled: remaining.length,
      required: rosterSlots.BN ?? 0,
    });
  }

  return fills;
}

/** Position counts among the most recent picks, most frequent first. */
export function positionalRun(
  picks: ApiDraftPick[],
  window: number,
): { position: string; count: number }[] {
  const recent = [...picks]
    .sort((a, b) => b.pickNo - a.pickNo)
    .slice(0, window);
  const counts = new Map<string, number>();

  for (const pick of recent) {
    if (pick.position) {
      counts.set(pick.position, (counts.get(pick.position) ?? 0) + 1);
    }
  }

  return [...counts]
    .map(([position, count]) => ({ position, count }))
    .sort((a, b) => b.count - a.count);
}

/** Sleeper-style "round.pick" label, e.g. `3.07`; the overall number
 * when the league size is unknown. */
export function formatPick(pickNo: number, teams?: number): string {
  if (!teams) {
    return `#${pickNo}`;
  }

  const round = Math.ceil(pickNo / teams);
  const pickInRound = ((pickNo - 1) % teams) + 1;

  return `${round}.${String(pickInRound).padStart(2, "0")}`;
}
