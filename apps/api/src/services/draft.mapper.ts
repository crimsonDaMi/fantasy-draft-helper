import {
  Draft,
  DraftPick,
  DraftStatus,
  ROSTER_SLOTS,
  RosterSlot,
} from "../domain/draft.js";
import { SleeperDraft, SleeperDraftPick } from "../types/sleeper.js";

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

function mapDraftOrder(
  draftOrder: SleeperDraft["draft_order"],
): Record<string, number> | undefined {
  if (!draftOrder) {
    return undefined;
  }

  const entries = Object.entries(draftOrder).filter(
    ([, slot]) => positiveInteger(slot) !== undefined,
  );

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export function mapSleeperDraft(draft: SleeperDraft): Draft {
  const settings = draft.settings ?? {};
  const name = draft.metadata?.name;

  return {
    id: draft.draft_id,
    status: mapDraftStatus(draft.status),
    sport: draft.sport,
    season: draft.season,
    leagueId: draft.league_id,
    startTime: draft.start_time,
    name: typeof name === "string" && name !== "" ? name : undefined,
    type: draft.type,
    teams: positiveInteger(settings.teams),
    rounds: positiveInteger(settings.rounds),
    reversalRound: positiveInteger(settings.reversal_round),
    draftOrder: mapDraftOrder(draft.draft_order),
    rosterSlots: mapRosterSlots(settings),
  };
}

export function mapSleeperDraftPick(pick: SleeperDraftPick): DraftPick | null {
  if (!pick.player_id) {
    return null;
  }

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
  };
}
