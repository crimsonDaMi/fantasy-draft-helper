import { describe, expect, it } from "vitest";

import type { ApiDraftPick } from "../types/api";
import {
  currentPickNo,
  fillRoster,
  formatPick,
  nextPickFor,
  picksForSlot,
  positionalRun,
  slotForPick,
} from "./draft-order";

function slotsForRound(
  round: number,
  teams: number,
  type: string,
  reversalRound?: number,
): number[] {
  return Array.from({ length: teams }, (_, index) =>
    slotForPick((round - 1) * teams + index + 1, teams, type, reversalRound),
  );
}

describe("slotForPick", () => {
  it.each([10, 12])("snakes every other round with %i teams", (teams) => {
    const forward = Array.from({ length: teams }, (_, index) => index + 1);
    const backward = [...forward].reverse();

    expect(slotsForRound(1, teams, "snake")).toEqual(forward);
    expect(slotsForRound(2, teams, "snake")).toEqual(backward);
    expect(slotsForRound(3, teams, "snake")).toEqual(forward);
  });

  it.each([10, 12])(
    "repeats round 2's order in round 3 with a third-round reversal (%i teams)",
    (teams) => {
      const forward = Array.from({ length: teams }, (_, index) => index + 1);
      const backward = [...forward].reverse();

      expect(slotsForRound(2, teams, "snake", 3)).toEqual(backward);
      expect(slotsForRound(3, teams, "snake", 3)).toEqual(backward);
      expect(slotsForRound(4, teams, "snake", 3)).toEqual(forward);
      expect(slotsForRound(5, teams, "snake", 3)).toEqual(backward);
    },
  );

  it.each([10, 12])(
    "keeps the same order in linear drafts (%i teams)",
    (teams) => {
      const forward = Array.from({ length: teams }, (_, index) => index + 1);

      expect(slotsForRound(1, teams, "linear")).toEqual(forward);
      expect(slotsForRound(2, teams, "linear")).toEqual(forward);
    },
  );
});

describe("nextPickFor", () => {
  const draft = { type: "snake", teams: 12, rounds: 15, rosterSlots: {} };

  it("is on the clock when the current pick is the slot's", () => {
    expect(nextPickFor(1, 1, draft)).toEqual({
      pickNo: 1,
      round: 1,
      pickInRound: 1,
      picksUntil: 0,
    });
  });

  it("counts picks until the slot's turn across the snake turn", () => {
    // Slot 1 picks 1st and 24th in a 12-team snake.
    expect(nextPickFor(1, 2, draft)).toEqual({
      pickNo: 24,
      round: 2,
      pickInRound: 12,
      picksUntil: 22,
    });
  });

  it("has no next pick after the last round, or in auctions", () => {
    expect(nextPickFor(1, 181, draft)).toBeUndefined();
    expect(nextPickFor(1, 1, { ...draft, type: "auction" })).toBeUndefined();
    expect(nextPickFor(1, 1, { ...draft, teams: undefined })).toBeUndefined();
  });
});

describe("currentPickNo", () => {
  it("is one past the highest pick made", () => {
    expect(currentPickNo([])).toBe(1);
    expect(
      currentPickNo([
        { pickNo: 2, playerId: "2" },
        { pickNo: 1, playerId: "1" },
      ]),
    ).toBe(3);
  });
});

describe("picksForSlot", () => {
  const picks: ApiDraftPick[] = [
    { pickNo: 1, playerId: "1", draftSlot: 1, pickedBy: "user-a" },
    { pickNo: 2, playerId: "2", draftSlot: 2, pickedBy: "user-b" },
    { pickNo: 3, playerId: "3", draftSlot: 2, pickedBy: "user-a" },
  ];

  it("matches by Sleeper user when known, so traded picks count", () => {
    expect(picksForSlot(picks, 1, "user-a").map((p) => p.playerId)).toEqual([
      "1",
      "3",
    ]);
  });

  it("matches by draft slot otherwise", () => {
    expect(picksForSlot(picks, 2).map((p) => p.playerId)).toEqual(["2", "3"]);
  });
});

describe("fillRoster", () => {
  it("fills exact slots, then flex slots, then the bench", () => {
    const fills = fillRoster(["QB", "QB", "RB", "RB", "RB", "WR", "QB"], {
      QB: 1,
      RB: 2,
      WR: 2,
      FLEX: 1,
      SUPER_FLEX: 1,
      BN: 5,
    });

    expect(fills).toEqual([
      { slot: "QB", filled: 1, required: 1 },
      { slot: "RB", filled: 2, required: 2 },
      { slot: "WR", filled: 1, required: 2 },
      { slot: "FLEX", filled: 1, required: 1 },
      { slot: "SUPER_FLEX", filled: 1, required: 1 },
      { slot: "BN", filled: 1, required: 5 },
    ]);
  });

  it("fills the narrowest flex slot first", () => {
    const fills = fillRoster(["TE", "RB"], {
      WRRB_FLEX: 1,
      FLEX: 1,
    });

    expect(fills).toEqual([
      { slot: "WRRB_FLEX", filled: 1, required: 1 },
      { slot: "FLEX", filled: 1, required: 1 },
    ]);
  });
});

describe("positionalRun", () => {
  it("counts positions among the most recent picks", () => {
    const picks: ApiDraftPick[] = [
      { pickNo: 1, playerId: "1", position: "QB" },
      { pickNo: 2, playerId: "2", position: "WR" },
      { pickNo: 3, playerId: "3", position: "WR" },
      { pickNo: 4, playerId: "4", position: "RB" },
    ];

    expect(positionalRun(picks, 3)).toEqual([
      { position: "WR", count: 2 },
      { position: "RB", count: 1 },
    ]);
  });
});

describe("formatPick", () => {
  it("formats round.pick, or the overall number without a league size", () => {
    expect(formatPick(1, 12)).toBe("1.01");
    expect(formatPick(31, 12)).toBe("3.07");
    expect(formatPick(31)).toBe("#31");
  });
});
