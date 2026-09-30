import {
  Draft,
  DraftPick,
  DraftStatus,
  ROSTER_SLOTS,
  RosterSlot,
  TradedPick,
} from "../domain/draft.js";
import {
  SleeperDraft,
  SleeperDraftPick,
  SleeperTradedPick,
} from "../types/sleeper.js";

export function mapDraftStatus(status: string): DraftStatus {
  switch (status) {
    case "pre_draft":
      return "PRE_DRAFT";

    case "drafting":
      return "DRAFTING";

    case "complete":
      return "COMPLETE";

    default:
      return "UNKNOWN";
  }
}

/** A positive integer setting, or undefined for anything else —
 * `settings` is untyped upstream data. */
function positiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : undefined;
}

function mapRosterSlots(
  settings: Record<string, unknown>,
): Partial<Record<RosterSlot, number>> {
  const slots: Partial<Record<RosterSlot, number>> = {};

  for (const slot of ROSTER_SLOTS) {
    const count = positiveInteger(settings[`slots_${slot.toLowerCase()}`]);

    if (count !== undefined) {
      slots[slot] = count;
    }
  }

  return slots;
}

/** Sleeper's `draft_order` and `slot_to_roster_id`, keeping only
 * positive integer values. */
function mapNumberRecord(
  record: Record<string, number> | null | undefined,
): Record<string, number> | undefined {
  if (!record) {
    return undefined;
  }

  const entries = Object.entries(record).filter(
    ([, slot]) => positiveInteger(slot) !== undefined,
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function mapTradedPicks(tradedPicks: SleeperTradedPick[]): TradedPick[] {
  return tradedPicks.flatMap((pick) => {
    const round = positiveInteger(pick.round);
    const rosterId = positiveInteger(pick.roster_id);
    const ownerId = positiveInteger(pick.owner_id);

    return round !== undefined &&
      rosterId !== undefined &&
      ownerId !== undefined
      ? [{ round, rosterId, ownerId }]
      : [];
  });
}

/** Maps a Sleeper draft; `tradedPicks` comes from a separate request, so
 * it's only passed when that request was made. */
export function mapSleeperDraft(
  draft: SleeperDraft,
  tradedPicks?: SleeperTradedPick[] | null,
): Draft {
  const settings = draft.settings ?? {};
  const name = draft.metadata?.name;
  const scoringType = draft.metadata?.scoring_type;

  return {
    id: draft.draft_id,
    status: mapDraftStatus(draft.status),
    sport: draft.sport,
    season: draft.season,
    leagueId: draft.league_id,
    startTime: draft.start_time,
    name: typeof name === "string" && name !== "" ? name : undefined,
    type: draft.type,
    scoringType:
      typeof scoringType === "string" && scoringType !== ""
        ? scoringType
        : undefined,
    teams: positiveInteger(settings.teams),
    rounds: positiveInteger(settings.rounds),
    reversalRound: positiveInteger(settings.reversal_round),
    draftOrder: mapNumberRecord(draft.draft_order),
    slotToRosterId: mapNumberRecord(draft.slot_to_roster_id),
    tradedPicks:
      tradedPicks === undefined ? undefined : mapTradedPicks(tradedPicks ?? []),
    budget: positiveInteger(settings.budget),
    rosterSlots: mapRosterSlots(settings),
  };
}

export function mapSleeperDraftPick(pick: SleeperDraftPick): DraftPick | null {
  if (!pick.player_id) {
    return null;
  }

  const amount = pick.metadata?.amount;

  return {
    playerId: pick.player_id,
    pickNo: pick.pick_no,
    round: pick.round,
    draftSlot: pick.draft_slot,
    rosterId: pick.roster_id !== undefined ? String(pick.roster_id) : undefined,
    pickedBy: pick.picked_by,
    playerName:
      [pick.metadata?.first_name, pick.metadata?.last_name]
        .filter(Boolean)
        .join(" ") || undefined,
    position: pick.metadata?.position,
    team: pick.metadata?.team,
    amount:
      amount !== undefined && /^\d+$/.test(amount) ? Number(amount) : undefined,
  };
}
