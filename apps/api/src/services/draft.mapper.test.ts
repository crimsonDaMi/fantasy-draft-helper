import { describe, expect, it } from "vitest";

import {
  mapDraftStatus,
  mapSleeperDraft,
  mapSleeperDraftPick,
} from "./draft.mapper.js";

describe("mapDraftStatus", () => {
  it("maps pre_draft", () => {
    expect(mapDraftStatus("pre_draft")).toBe("PRE_DRAFT");
  });

  it("maps drafting", () => {
    expect(mapDraftStatus("drafting")).toBe("DRAFTING");
  });

  it("maps complete", () => {
    expect(mapDraftStatus("complete")).toBe("COMPLETE");
  });

  it("maps unknown statuses", () => {
    expect(mapDraftStatus("something_else")).toBe("UNKNOWN");
  });
});

describe("mapSleeperDraftPick", () => {
  it("maps a player pick", () => {
    const result = mapSleeperDraftPick({
      player_id: "123",
      pick_no: 1,
      round: 1,
      draft_slot: 1,
      metadata: {
        position: "QB",
        team: "BUF",
      },
    });

    expect(result).toEqual({
      playerId: "123",
      pickNo: 1,
      round: 1,
      draftSlot: 1,
      rosterId: undefined,
      pickedBy: undefined,
      playerName: undefined,
      position: "QB",
      team: "BUF",
    });
  });

  it("returns null without player ID", () => {
    const result = mapSleeperDraftPick({
      pick_no: 1,
    });

    expect(result).toBeNull();
  });
});

describe("mapSleeperDraft", () => {
  it("maps draft settings, order, and roster slots", () => {
    const result = mapSleeperDraft({
      draft_id: "draft-1",
      status: "drafting",
      sport: "nfl",
      season: "2026",
      type: "snake",
      metadata: { name: "Test League" },
      draft_order: { "user-a": 1, "user-b": 2 },
      settings: {
        teams: 12,
        rounds: 16,
        reversal_round: 3,
        slots_qb: 1,
        slots_super_flex: 1,
        slots_flex: 2,
        slots_bn: 6,
        slots_k: 0,
        slots_dl: 2,
        pick_timer: 60,
      },
    });

    expect(result).toMatchObject({
      name: "Test League",
      type: "snake",
      teams: 12,
      rounds: 16,
      reversalRound: 3,
      draftOrder: { "user-a": 1, "user-b": 2 },
      rosterSlots: { QB: 1, SUPER_FLEX: 1, FLEX: 2, BN: 6 },
    });
  });

  it("tolerates missing settings and an empty draft order", () => {
    const result = mapSleeperDraft({
      draft_id: "draft-1",
      status: "pre_draft",
      sport: "nfl",
      season: "2026",
      draft_order: null,
    });

    expect(result.teams).toBeUndefined();
    expect(result.reversalRound).toBeUndefined();
    expect(result.draftOrder).toBeUndefined();
    expect(result.rosterSlots).toEqual({});
  });
});

describe("mapSleeperDraftPick player name", () => {
  it("joins first and last name from the pick metadata", () => {
    const result = mapSleeperDraftPick({
      player_id: "123",
      pick_no: 1,
      metadata: { first_name: "Player", last_name: "One" },
    });

    expect(result?.playerName).toBe("Player One");
  });
});
