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
    expect(result.tradedPicks).toBeUndefined();
  });

  it("maps the slot-to-roster mapping and traded picks", () => {
    const result = mapSleeperDraft(
      {
        draft_id: "draft-1",
        status: "drafting",
        sport: "nfl",
        season: "2026",
        slot_to_roster_id: { "1": 3, "2": 1 },
      },
      [
        {
          season: "2026",
          round: 2,
          roster_id: 3,
          previous_owner_id: 3,
          owner_id: 1,
        },
        { round: 0, roster_id: 3, owner_id: 1 },
      ],
    );

    expect(result.slotToRosterId).toEqual({ "1": 3, "2": 1 });
    expect(result.tradedPicks).toEqual([{ round: 2, rosterId: 3, ownerId: 1 }]);
  });

  it("treats Sleeper's null traded picks as none", () => {
    const result = mapSleeperDraft(
      { draft_id: "draft-1", status: "drafting", sport: "nfl", season: "2026" },
      null,
    );

    expect(result.tradedPicks).toEqual([]);
  });

  it("maps the auction budget", () => {
    const result = mapSleeperDraft({
      draft_id: "draft-1",
      status: "drafting",
      sport: "nfl",
      season: "2026",
      type: "auction",
      settings: { budget: 200 },
    });

    expect(result.budget).toBe(200);
  });
});

describe("mapSleeperDraftPick auction amount", () => {
  it("parses the winning bid", () => {
    const result = mapSleeperDraftPick({
      player_id: "123",
      pick_no: 1,
      metadata: { amount: "25" },
    });

    expect(result?.amount).toBe(25);
  });

  it("ignores a missing or malformed bid", () => {
    expect(
      mapSleeperDraftPick({ player_id: "123", pick_no: 1 })?.amount,
    ).toBeUndefined();
    expect(
      mapSleeperDraftPick({
        player_id: "123",
        pick_no: 1,
        metadata: { amount: "" },
      })?.amount,
    ).toBeUndefined();
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
