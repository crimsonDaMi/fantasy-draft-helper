import { describe, expect, it } from "vitest";

import {
  buildContainers,
  computeGlobalRank,
  findContainer,
  filterPlayersByPosition,
  filterPlayersByQuery,
  formatTierHeading,
  withForcedActiveRow,
  type Containers,
} from "./ranking-editor-logic";

function rankingPlayer(
  sleeperId: string,
  fullName: string,
  tier: string,
  rank: number,
) {
  return {
    ranking: { rank, playerName: fullName, tier },
    player: { sleeperId, fullName },
    method: "SLEEPER_ID",
  };
}

describe("buildContainers", () => {
  it("groups matched players by tier and appends the unranked panel", () => {
    const players = [
      rankingPlayer("1", "Player One", "S", 1),
      rankingPlayer("2", "Player Two", "A", 2),
    ];
    const tiers = [
      { label: "S", position: 1, playerCount: 1 },
      { label: "A", position: 2, playerCount: 1 },
    ];
    const unranked = [{ sleeperId: "3", fullName: "Player Three" }];

    const result = buildContainers(players, tiers, unranked);

    expect(result.S.map((p) => p.sleeperId)).toEqual(["1"]);
    expect(result.A.map((p) => p.sleeperId)).toEqual(["2"]);
    expect(result.unranked.map((p) => p.sleeperId)).toEqual(["3"]);
  });

  it("skips ranking rows with no matched player", () => {
    const players = [
      {
        ranking: { rank: 1, playerName: "Unmatched", tier: "S" },
        method: "NONE",
      },
    ];
    const tiers = [{ label: "S", position: 1, playerCount: 0 }];

    const result = buildContainers(players as never, tiers, []);

    expect(result.S).toEqual([]);
  });
});

describe("findContainer", () => {
  const containers: Containers = {
    S: [{ sleeperId: "1", fullName: "Player One" }],
    A: [],
    unranked: [{ sleeperId: "2", fullName: "Player Two" }],
  };

  it("resolves a player id to its containing tier", () => {
    expect(findContainer(containers, "1")).toBe("S");
    expect(findContainer(containers, "2")).toBe("unranked");
  });

  it("resolves a bare container id to itself (dropped on an empty tier)", () => {
    expect(findContainer(containers, "A")).toBe("A");
  });

  it("returns undefined for an id in no container", () => {
    expect(findContainer(containers, "missing")).toBeUndefined();
  });
});

describe("computeGlobalRank", () => {
  it("returns the in-tier index plus one when it's the first tier", () => {
    const containers: Containers = { S: [], A: [] };
    expect(computeGlobalRank(containers, ["S", "A"], "S", 0)).toBe(1);
  });

  it("adds the player counts of every tier ranked ahead of the target", () => {
    const containers: Containers = {
      S: [
        { sleeperId: "1", fullName: "One" },
        { sleeperId: "2", fullName: "Two" },
      ],
      A: [{ sleeperId: "3", fullName: "Three" }],
      B: [],
    };

    expect(computeGlobalRank(containers, ["S", "A", "B"], "B", 0)).toBe(4);
  });

  it("ignores tiers ranked after the target", () => {
    const containers: Containers = {
      S: [{ sleeperId: "1", fullName: "One" }],
      A: [{ sleeperId: "2", fullName: "Two" }],
    };

    expect(computeGlobalRank(containers, ["S", "A"], "S", 0)).toBe(1);
  });
});

describe("formatTierHeading", () => {
  it("renders the alphabetical label by default", () => {
    expect(formatTierHeading("S", 1, "alpha")).toBe("Tier S");
    expect(formatTierHeading("B", 3, "alpha")).toBe("Tier B");
  });

  it("renders the numeric position in numeric mode", () => {
    expect(formatTierHeading("S", 1, "numeric")).toBe("Tier 1");
    expect(formatTierHeading("B", 3, "numeric")).toBe("Tier 3");
  });
});

describe("withForcedActiveRow", () => {
  const players = [
    { sleeperId: "1", fullName: "One" },
    { sleeperId: "2", fullName: "Two" },
    { sleeperId: "3", fullName: "Three" },
  ];

  it("returns the visible rows unchanged when there is no active drag", () => {
    const visible = [{ index: 0, start: 0 }];
    expect(withForcedActiveRow(visible, players, undefined)).toEqual(visible);
  });

  it("returns the visible rows unchanged when the active item is already visible", () => {
    const visible = [
      { index: 0, start: 0 },
      { index: 1, start: 36 },
    ];
    expect(withForcedActiveRow(visible, players, "2")).toEqual(visible);
  });

  it("adds the active item's row when it has scrolled out of the visible window", () => {
    const visible = [{ index: 0, start: 0 }];
    const result = withForcedActiveRow(visible, players, "3");
    expect(result).toEqual([
      { index: 0, start: 0 },
      { index: 2, start: 72 },
    ]);
  });

  it("ignores an active id that does not belong to this container", () => {
    const visible = [{ index: 0, start: 0 }];
    expect(withForcedActiveRow(visible, players, "not-in-this-tier")).toEqual(
      visible,
    );
  });
});

describe("filterPlayersByPosition", () => {
  const players = [
    { sleeperId: "1", fullName: "Josh Allen", position: "QB", team: "BUF" },
    { sleeperId: "2", fullName: "D.J. Moore", position: "WR", team: "CHI" },
    { sleeperId: "3", fullName: "Josh Jacobs", position: "RB", team: "GB" },
  ];

  it("returns the same array when no positions are selected", () => {
    expect(filterPlayersByPosition(players, [])).toBe(players);
  });

  it("keeps only players matching a selected position", () => {
    const result = filterPlayersByPosition(players, ["RB"]);
    expect(result.map((p) => p.sleeperId)).toEqual(["3"]);
  });

  it("supports multiple selected positions", () => {
    const result = filterPlayersByPosition(players, ["QB", "WR"]);
    expect(result.map((p) => p.sleeperId)).toEqual(["1", "2"]);
  });

  it("excludes a player with no position when a filter is active", () => {
    const noPosition = [{ sleeperId: "4", fullName: "No Position Guy" }];
    expect(filterPlayersByPosition(noPosition, ["QB"])).toEqual([]);
  });
});

describe("filterPlayersByQuery", () => {
  const players = [
    { sleeperId: "1", fullName: "Josh Allen", team: "BUF" },
    { sleeperId: "2", fullName: "D.J. Moore", team: "CHI" },
    { sleeperId: "3", fullName: "Josh Jacobs", team: "GB" },
  ];

  it("returns the same array when the query is empty", () => {
    expect(filterPlayersByQuery(players, "")).toBe(players);
  });

  it("matches by case-insensitive name substring", () => {
    const result = filterPlayersByQuery(players, "josh");
    expect(result.map((p) => p.sleeperId)).toEqual(["1", "3"]);
  });

  it("matches by team", () => {
    const result = filterPlayersByQuery(players, "chi");
    expect(result.map((p) => p.sleeperId)).toEqual(["2"]);
  });

  it("trims and ignores case in the query", () => {
    const result = filterPlayersByQuery(players, "  MOORE  ");
    expect(result.map((p) => p.sleeperId)).toEqual(["2"]);
  });
});
