import type { ApiDraftInfo, ApiDraftPick } from "../types/api";

/** Round and 1-based pick within the round of an overall pick number. */
function pickPosition(
  pickNo: number,
  teams: number,
): { round: number; pickInRound: number } {
  return {
    round: Math.ceil(pickNo / teams),
    pickInRound: ((pickNo - 1) % teams) + 1,
  };
}

/** Draft slot (1-based) that owns a given overall pick. Linear drafts
 * repeat the same order every round; snake drafts reverse every other
 * round, and with a reversal round (third-round reversal) the direction
 * flips once more from that round on. Traded picks aren't reflected
 * here — see `nextPickFor`. */
export function slotForPick(
  pickNo: number,
  teams: number,
  type: string | undefined,
  reversalRound?: number,
): number {
  const { round, pickInRound } = pickPosition(pickNo, teams);

  if (type === "linear") {
    return pickInRound;
  }

  let reversed = round % 2 === 0;

  if (reversalRound !== undefined && round >= reversalRound) {
    reversed = !reversed;
  }

  return reversed ? teams - pickInRound + 1 : pickInRound;
}

export interface NextPick {
  pickNo: number;
  round: number;
  pickInRound: number;
  /** 0 when the slot is on the clock. */
  picksUntil: number;
  /** The pick originally belonged to another slot. */
  traded: boolean;
}

/** League roster that holds the given pick: the slot's own roster unless
 * the pick was traded. */
function pickOwner(
  pickNo: number,
  pickSlot: number,
  draft: ApiDraftInfo,
): number | undefined {
  const { round } = pickPosition(pickNo, draft.teams ?? 1);
  const originalRoster = draft.slotToRosterId?.[pickSlot];
  const trade = draft.tradedPicks?.find(
    (pick) => pick.round === round && pick.rosterId === originalRoster,
  );

  return trade?.ownerId ?? originalRoster;
}

/** The slot's next pick at or after `currentPickNo`, or undefined when
 * it has none left (or the draft has no pick order, e.g. auctions).
 * Follows traded picks when Sleeper maps slots to league rosters; mock
 * drafts have no rosters, and no trades. */
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
  const rosterId = draft.slotToRosterId?.[slot];

  for (let pickNo = currentPickNo; pickNo <= lastPickNo; pickNo++) {
    const pickSlot = slotForPick(pickNo, teams, type, reversalRound);
    const isMine =
      rosterId === undefined
        ? pickSlot === slot
        : pickOwner(pickNo, pickSlot, draft) === rosterId;

    if (isMine) {
      return {
        pickNo,
        ...pickPosition(pickNo, teams),
        picksUntil: pickNo - currentPickNo,
        traded: pickSlot !== slot,
      };
    }
  }

  return undefined;
}

/** Overall number of the pick currently on the clock. */
export function currentPickNo(picks: ApiDraftPick[]): number {
  return picks.reduce((highest, pick) => Math.max(highest, pick.pickNo), 0) + 1;
}

/** The picks made by the given slot — by Sleeper user or league roster
 * when known, so a pick made on a traded draft position still counts as
 * the user's. */
export function picksForSlot(
  picks: ApiDraftPick[],
  slot: number,
  sleeperUserId?: string,
  rosterId?: number,
): ApiDraftPick[] {
  return picks.filter((pick) => {
    if (sleeperUserId !== undefined && pick.pickedBy !== undefined) {
      return pick.pickedBy === sleeperUserId;
    }

    if (rosterId !== undefined && pick.rosterId !== undefined) {
      return pick.rosterId === String(rosterId);
    }

    return pick.draftSlot === slot;
  });
}

export interface AuctionBudget {
  budget: number;
  left: number;
  /** Highest bid that still leaves $1 for every other open roster spot;
   * undefined when the roster size is unknown or the roster is full. */
  maxBid?: number;
}

/** What's left of the user's auction budget after their winning bids. */
export function auctionBudget(
  draft: ApiDraftInfo,
  myPicks: ApiDraftPick[],
): AuctionBudget | undefined {
  if (draft.type !== "auction" || !draft.budget) {
    return undefined;
  }

  const spent = myPicks.reduce((total, pick) => total + (pick.amount ?? 0), 0);
  const left = draft.budget - spent;
  const openSpots =
    draft.rounds !== undefined ? draft.rounds - myPicks.length : 0;

  return {
    budget: draft.budget,
    left,
    maxBid: openSpots > 0 ? Math.max(left - (openSpots - 1), 0) : undefined,
  };
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

  const { round, pickInRound } = pickPosition(pickNo, teams);

  return `${round}.${String(pickInRound).padStart(2, "0")}`;
}
