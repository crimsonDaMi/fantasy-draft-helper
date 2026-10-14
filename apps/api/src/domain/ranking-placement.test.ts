import { describe, expect, it } from "vitest";

import { PlayerMatch } from "./player-match.js";
import { fittingTier, indexOfMatchedRank } from "./ranking-placement.js";

function matched(tier: string, sleeperId: string): PlayerMatch {
  return {
    ranking: { rank: 0, playerName: `Player ${sleeperId}`, tier },
    player: {
      sleeperId,
      fullName: `Player ${sleeperId}`,
      active: true,
      fantasyPositions: ["WR"],
    },
    method: "SLEEPER_ID",
  };
}

function unmatched(tier: string): PlayerMatch {
  return {
    ranking: { rank: 0, playerName: "Unknown Player", tier },
    method: "NONE",
  };
}

describe("indexOfMatchedRank", () => {
  const rows = [matched("S", "1"), unmatched("S"), matched("A", "2")];

  it("counts matched rows only", () => {
    expect(indexOfMatchedRank(rows, 1)).toBe(0);
    expect(indexOfMatchedRank(rows, 2)).toBe(2);
  });

  it("treats a rank below 1 as the first matched row", () => {
    expect(indexOfMatchedRank(rows, 0)).toBe(0);
  });

  it("returns the end of the list past the last matched row", () => {
    expect(indexOfMatchedRank(rows, 3)).toBe(3);
  });
});

describe("fittingTier", () => {
  it("keeps the preferred tier when it fits between its neighbors", () => {
    const rows = [matched("S", "1"), unmatched("A"), matched("B", "2")];

    expect(fittingTier(rows, 1, "A")).toBe("A");
  });

  it("joins the tier above when the preferred tier no longer fits", () => {
    const rows = [matched("B", "1"), unmatched("S"), matched("B", "2")];

    expect(fittingTier(rows, 1, "S")).toBe("B");
  });

  it("joins the tier below when nothing matched is above", () => {
    const rows = [unmatched("C"), matched("A", "1")];

    expect(fittingTier(rows, 0, "C")).toBe("A");
  });

  it("keeps the preferred tier when there are no matched rows", () => {
    expect(fittingTier([unmatched("C")], 0, "C")).toBe("C");
  });
});
