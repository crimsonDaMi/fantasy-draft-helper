export type DraftStatus =
  | "PRE_DRAFT"
  | "DRAFTING"
  | "COMPLETE"
  | "UNKNOWN";

export interface Draft {
  id: string;

  status: DraftStatus;

  sport: string;

  season: string;

  leagueId?: string;

  startTime?: number | null;
}

export interface DraftPick {
  playerId: string;

  pickNo: number;

  round?: number;

  draftSlot?: number;

  rosterId?: string;

  pickedBy?: string;

  position?: string;

  team?: string;
}