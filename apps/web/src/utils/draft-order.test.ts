import { describe, expect, it } from "vitest";

import type { ApiDraftPick } from "../types/api";
import {
  auctionBudget,
  currentPickNo,
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
      traded: false,
    });
  });

  it("counts picks until the slot's turn across the snake turn", () => {
    // Slot 1 picks 1st and 24th in a 12-team snake.
    expect(nextPickFor(1, 2, draft)).toEqual({
      pickNo: 24,
      round: 2,
      pickInRound: 12,
      picksUntil: 22,
      traded: false,
    });
  });

  it("has no next pick after the last round, or in auctions", () => {
    expect(nextPickFor(1, 181, draft)).toBeUndefined();
    expect(nextPickFor(1, 1, { ...draft, type: "auction" })).toBeUndefined();
    expect(nextPickFor(1, 1, { ...draft, teams: undefined })).toBeUndefined();
  });

  describe("with traded picks", () => {
    // 4-team snake; slot N belongs to roster 10 + N.
    const league = {
      type: "snake",
      teams: 4,
      rounds: 3,
      rosterSlots: {},
      slotToRosterId: { "1": 11, "2": 12, "3": 13, "4": 14 },
    };

    it("skips a pick traded away", () => {
      // Slot 1 picks 1st and 8th; its round-2 pick went to roster 13.
      const next = nextPickFor(1, 2, {
        ...league,
        tradedPicks: [{ round: 2, rosterId: 11, ownerId: 13 }],
      });

      expect(next).toMatchObject({ pickNo: 9, picksUntil: 7, traded: false });
    });

    it("includes and marks a pick acquired by trade", () => {
      // Slot 1 holds slot 3's round-2 pick (6th overall).
      const next = nextPickFor(1, 2, {
        ...league,
        tradedPicks: [{ round: 2, rosterId: 13, ownerId: 11 }],
      });

      expect(next).toMatchObject({
        pickNo: 6,
        round: 2,
        pickInRound: 2,
        picksUntil: 4,
        traded: true,
      });
    });

    it("has no next pick when the remaining ones were all traded away", () => {
      const next = nextPickFor(1, 2, {
        ...league,
        tradedPicks: [
          { round: 2, rosterId: 11, ownerId: 12 },
          { round: 3, rosterId: 11, ownerId: 12 },
        ],
      });

      expect(next).toBeUndefined();
    });
  });
});

describe("auctionBudget", () => {
  const draft = {
    type: "auction",
    teams: 12,
    rounds: 15,
    budget: 200,
    rosterSlots: {},
  };

  it("subtracts winning bids and keeps $1 per other open spot", () => {
    const picks: ApiDraftPick[] = [
      { pickNo: 1, playerId: "1", amount: 50 },
      { pickNo: 2, playerId: "2", amount: 8 },
    ];

    // 13 open spots: 12 of them need at least $1.
    expect(auctionBudget(draft, picks)).toEqual({
      budget: 200,
      left: 142,
      maxBid: 130,
    });
  });

  it("has no max bid without a roster size or with a full roster", () => {
    expect(auctionBudget({ ...draft, rounds: undefined }, [])).toEqual({
      budget: 200,
      left: 200,
      maxBid: undefined,
    });
    expect(
      auctionBudget({ ...draft, rounds: 1 }, [
        { pickNo: 1, playerId: "1", amount: 1 },
      ])?.maxBid,
    ).toBeUndefined();
  });

  it("is undefined outside auctions or without a budget", () => {
    expect(auctionBudget({ ...draft, type: "snake" }, [])).toBeUndefined();
    expect(auctionBudget({ ...draft, budget: undefined }, [])).toBeUndefined();
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

  it("matches by league roster without a Sleeper user", () => {
    const rosterPicks: ApiDraftPick[] = [
      { pickNo: 1, playerId: "1", draftSlot: 1, rosterId: "7" },
      { pickNo: 2, playerId: "2", draftSlot: 2, rosterId: "8" },
      { pickNo: 3, playerId: "3", draftSlot: 2, rosterId: "7" },
    ];

    expect(
      picksForSlot(rosterPicks, 1, undefined, 7).map((p) => p.playerId),
    ).toEqual(["1", "3"]);
  });

  it("matches by draft slot otherwise", () => {
    expect(picksForSlot(picks, 2).map((p) => p.playerId)).toEqual(["2", "3"]);
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
