export type DraftStatus = "PRE_DRAFT" | "DRAFTING" | "COMPLETE" | "UNKNOWN";

/** Lineup slots Sleeper reports as `settings.slots_<name>`. */
export const ROSTER_SLOTS = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DEF",
  "FLEX",
  "WRRB_FLEX",
  "REC_FLEX",
  "SUPER_FLEX",
  "BN",
] as const;

export type RosterSlot = (typeof ROSTER_SLOTS)[number];

export interface Draft {
  id: string;
  status: DraftStatus;
  sport: string;
  season: string;
  leagueId?: string;
  startTime?: number | null;
  name?: string;
  /** Sleeper's draft type: `snake`, `linear`, or `auction`. */
  type?: string;
  teams?: number;
  rounds?: number;
  /** Third-round-reversal style: from this round on, snake order flips. */
  reversalRound?: number;
  /** Sleeper user ID → draft slot (1-based). */
  draftOrder?: Record<string, number>;
  /** Draft slot (1-based) → the league roster that owns its picks. */
  slotToRosterId?: Record<string, number>;
  /** Picks that changed hands; only filled for a single draft lookup. */
  tradedPicks?: TradedPick[];
  /** Auction budget per team. */
  budget?: number;
  rosterSlots: Partial<Record<RosterSlot, number>>;
}

export interface TradedPick {
  round: number;
  /** Roster the pick originally belonged to. */
  rosterId: number;
  /** Roster that holds the pick now. */
  ownerId: number;
}

export interface DraftPick {
  playerId: string;
  pickNo: number;
  round?: number;
  draftSlot?: number;
  rosterId?: string;
  pickedBy?: string;
  playerName?: string;
  position?: string;
  team?: string;
  /** Winning bid in auctions. */
  amount?: number;
}
