import { describe, expect, it } from "vitest";

import { withLivePlayer } from "./with-live-player.js";

const stored = {
  ranking: {
    rank: 1,
    playerName: "P. One",
    team: "BUF",
    position: "QB" as const,
  },
  player: {
    sleeperId: "1",
    fullName: "P. One",
    team: "BUF",
    position: "QB",
    injuryStatus: "Out",
    active: true,
    fantasyPositions: ["QB"],
  },
  method: "SLEEPER_ID" as const,
};

describe("withLivePlayer", () => {
  it("uses the live player from the cache", () => {
    const live = {
      sleeperId: "1",
      fullName: "Player One",
      team: "KC",
      position: "QB",
      injuryStatus: "Questionable",
      active: true,
      fantasyPositions: ["QB"],
    };

    expect(withLivePlayer(stored, () => live).player).toBe(live);
  });

  it("keeps the row's data, without an injury status, for an unknown player", () => {
    expect(withLivePlayer(stored, () => undefined).player).toEqual({
      ...stored.player,
      injuryStatus: undefined,
    });
  });

  it("leaves unmatched rows alone", () => {
    const unmatched = { ranking: stored.ranking, method: "NONE" as const };

    expect(withLivePlayer(unmatched, () => undefined)).toBe(unmatched);
  });
});
