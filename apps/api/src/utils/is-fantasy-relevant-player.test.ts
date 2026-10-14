import { describe, expect, it } from "vitest";

import { Player } from "../domain/player.js";
import {
  hasRelevantFantasyPosition,
  isFantasyRelevantPlayer,
} from "./is-fantasy-relevant-player.js";

const NOW = Date.parse("2026-10-14T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function createPlayer(fantasyPositions: string[]): Player {
  return {
    sleeperId: "1",
    fullName: "Test Player",
    team: "BUF",
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
        team: "BUF",
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

  it("accepts a player with news in the past year, on a team or not", () => {
    const recentNews = NOW - 300 * DAY_MS;

    expect(
      isFantasyRelevantPlayer(
        { ...createPlayer(["WR"]), lastNewsAt: recentNews },
        NOW,
      ),
    ).toBe(true);
    expect(
      isFantasyRelevantPlayer(
        { ...createPlayer(["WR"]), team: undefined, lastNewsAt: recentNews },
        NOW,
      ),
    ).toBe(true);
  });

  it("rejects a player Sleeper still lists as active without news for over a year", () => {
    expect(
      isFantasyRelevantPlayer(
        { ...createPlayer(["QB"]), lastNewsAt: NOW - 400 * DAY_MS },
        NOW,
      ),
    ).toBe(false);
  });

  it("rejects a free agent without any news", () => {
    expect(
      isFantasyRelevantPlayer(
        { ...createPlayer(["TE"]), team: undefined },
        NOW,
      ),
    ).toBe(false);
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
