import {
  Draft,
  DraftPick,
  DraftStatus,
} from "../domain/draft.js";

import {
  SleeperDraft,
  SleeperDraftPick,
} from "../types/sleeper.js";

export function mapDraftStatus(
  status: string,
): DraftStatus {
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

export function mapSleeperDraft(
  draft: SleeperDraft,
): Draft {
  return {
    id: draft.draft_id,

    status: mapDraftStatus(
      draft.status,
    ),

    sport: draft.sport,

    season: draft.season,

    leagueId: draft.league_id,

    startTime: draft.start_time,
  };
}

export function mapSleeperDraftPick(
  pick: SleeperDraftPick,
): DraftPick | null {
  if (!pick.player_id) {
    return null;
  }

  return {
    playerId: pick.player_id,

    pickNo: pick.pick_no,

    round: pick.round,

    draftSlot: pick.draft_slot,

    rosterId:
      pick.roster_id !== undefined
        ? String(pick.roster_id)
        : undefined,

    pickedBy: pick.picked_by,

    position: pick.metadata?.position,

    team: pick.metadata?.team,
  };
}