import { POSITIONS } from "./positions";

const FLEX_SLOTS: { slot: string; positions: string[] }[] = [
  // Most restrictive first, so a player isn't spent on a wider flex slot
  // that someone else could have filled.
  { slot: "WRRB_FLEX", positions: ["RB", "WR"] },
  { slot: "REC_FLEX", positions: ["WR", "TE"] },
  { slot: "FLEX", positions: ["RB", "WR", "TE"] },
  { slot: "SUPER_FLEX", positions: ["QB", "RB", "WR", "TE"] },
];

const STARTER_SLOTS = POSITIONS;

export const BENCH_SLOT = "BN";

export const ROSTER_SLOT_LABELS: Record<string, string> = {
  WRRB_FLEX: "W/R",
  REC_FLEX: "W/T",
  FLEX: "FLEX",
  SUPER_FLEX: "SF",
  [BENCH_SLOT]: "BN",
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
  return assignSlots(positions, rosterSlots).fills;
}

/** Indexes (into `positions`) of the players that fill a starting slot,
 * by the same greedy fill as `fillRoster`; in draft order, the earlier
 * pick at a position starts. */
export function starterIndexes(
  positions: (string | undefined)[],
  rosterSlots: Record<string, number>,
): Set<number> {
  return assignSlots(positions, rosterSlots).starters;
}

function assignSlots(
  positions: (string | undefined)[],
  rosterSlots: Record<string, number>,
): { fills: RosterSlotFill[]; starters: Set<number> } {
  const remaining = positions.flatMap((position, index) =>
    position === undefined ? [] : [{ position, index }],
  );
  const fills: RosterSlotFill[] = [];
  const starters = new Set<number>();

  function take(slot: string, accepts: string[]) {
    const required = rosterSlots[slot] ?? 0;

    if (required === 0) {
      return;
    }

    let filled = 0;

    while (filled < required) {
      const found = remaining.findIndex(({ position }) =>
        accepts.includes(position),
      );

      if (found === -1) {
        break;
      }

      starters.add(remaining.splice(found, 1)[0]!.index);
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

  if (remaining.length > 0 || rosterSlots[BENCH_SLOT]) {
    fills.push({
      slot: BENCH_SLOT,
      filled: remaining.length,
      required: rosterSlots[BENCH_SLOT] ?? 0,
    });
  }

  return { fills, starters };
}
