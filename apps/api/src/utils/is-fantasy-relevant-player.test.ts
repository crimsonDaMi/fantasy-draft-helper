import { describe, expect, it } from "vitest";

import { Player } from "../domain/player.js";

import {
  hasRelevantFantasyPosition,
  isFantasyRelevantPlayer,
} from "./is-fantasy-relevant-player.js";

function createPlayer(fantasyPositions: string[]): Player {
  return {
    sleeperId: "1",

    fullName: "Test Player",

    active: true,

    fantasyPositions,
  };
}

describe("isFantasyRelevantPlayer", () => {
  it("accepts an active fantasy player", () => {
    expect(
      isFantasyRelevantPlayer({
        sleeperId: "1",

        fullName: "Josh Allen",

        active: true,

        fantasyPositions: ["QB"],
      }),
    ).toBe(true);
  });

  it("rejects an inactive player", () => {
    expect(
      isFantasyRelevantPlayer({
        sleeperId: "1",

        fullName: "Retired Player",

        active: false,

        fantasyPositions: ["QB"],
      }),
    ).toBe(false);
  });

  it("rejects a player without fantasy positions", () => {
    expect(
      isFantasyRelevantPlayer({
        sleeperId: "1",

        fullName: "Non Fantasy Player",

        active: true,

        fantasyPositions: [],
      }),
    ).toBe(false);
  });

  it("rejects individual defensive players", () => {
    expect(isFantasyRelevantPlayer(createPlayer(["LB"]))).toBe(false);

    expect(isFantasyRelevantPlayer(createPlayer(["DB", "S"]))).toBe(false);
  });

  it("accepts team defenses, kickers, and mixed positions", () => {
    expect(isFantasyRelevantPlayer(createPlayer(["DEF"]))).toBe(true);

    expect(isFantasyRelevantPlayer(createPlayer(["K"]))).toBe(true);

    expect(isFantasyRelevantPlayer(createPlayer(["WR", "CB"]))).toBe(true);
  });
});

describe("hasRelevantFantasyPosition", () => {
  it("ignores the active flag", () => {
    expect(
      hasRelevantFantasyPosition({ ...createPlayer(["QB"]), active: false }),
    ).toBe(true);
  });

  it("rejects players without a relevant position", () => {
    expect(hasRelevantFantasyPosition(createPlayer(["DL"]))).toBe(false);

    expect(hasRelevantFantasyPosition(createPlayer([]))).toBe(false);
  });
});
