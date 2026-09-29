import { describe, expect, it } from "vitest";

import {
  appendPlayerToTier,
  buildContainers,
  computeGlobalRank,
  filterPlayers,
  filterPlayersByPosition,
  filterPlayersByQuery,
  formatTierHeading,
  movePlayerToContainer,
  stepPlayer,
  withForcedRows,
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
  it("carries each ranked player's flag", () => {
    const result = buildContainers(
      [
        rankingPlayer("1", "Player One", "S", 1),
        rankingPlayer("2", "Player Two", "S", 2),
      ],
      [{ label: "S", position: 1, playerCount: 2 }],
      [],
      { "2": "avoid" },
    );

    expect(result.S.map((p) => p.flag)).toEqual([undefined, "avoid"]);
  });

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
    expect(result.S[0]?.globalRank).toBe(1);
    expect(result.A[0]?.globalRank).toBe(2);
  });

  it("leaves unranked players without a globalRank", () => {
    const unranked = [{ sleeperId: "3", fullName: "Player Three" }];
    const result = buildContainers([], [], unranked);
    expect(result.unranked[0]?.globalRank).toBeUndefined();
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

describe("movePlayerToContainer", () => {
  const containers: Containers = {
    S: [
      { sleeperId: "1", fullName: "Player One" },
      { sleeperId: "2", fullName: "Player Two" },
    ],
    A: [{ sleeperId: "3", fullName: "Player Three" }],
    unranked: [],
  };

  it("inserts the player just before the player it's over", () => {
    const result = movePlayerToContainer(containers, "2", "S", "3", "A");

    expect(result.S.map((p) => p.sleeperId)).toEqual(["1"]);
    expect(result.A.map((p) => p.sleeperId)).toEqual(["2", "3"]);
  });

  it("appends when dropped on the container itself", () => {
    const result = movePlayerToContainer(
      containers,
      "1",
      "S",
      "unranked",
      "unranked",
    );

    expect(result.unranked.map((p) => p.sleeperId)).toEqual(["1"]);
    expect(result.S.map((p) => p.sleeperId)).toEqual(["2"]);
  });

  it("returns the same object when the player isn't in the source", () => {
    expect(movePlayerToContainer(containers, "3", "S", "A", "A")).toBe(
      containers,
    );
  });

  it("does not mutate the input", () => {
    movePlayerToContainer(containers, "2", "S", "3", "A");

    expect(containers.S).toHaveLength(2);
    expect(containers.A).toHaveLength(1);
  });
});

describe("appendPlayerToTier", () => {
  const containers: Containers = {
    S: [
      { sleeperId: "1", fullName: "Player One" },
      { sleeperId: "2", fullName: "Player Two" },
    ],
    A: [{ sleeperId: "3", fullName: "Player Three" }],
    unranked: [{ sleeperId: "4", fullName: "Player Four" }],
  };
  const ids = (result: Containers) =>
    Object.fromEntries(
      Object.entries(result).map(([id, players]) => [
        id,
        players.map((p) => p.sleeperId),
      ]),
    );

  it("moves a player to the end of a lower tier", () => {
    const result = appendPlayerToTier(containers, "1", "S", "A");

    expect(ids(result)).toEqual({ S: ["2"], A: ["3", "1"], unranked: ["4"] });
    expect(computeGlobalRank(result, ["S", "A"], "A", 1)).toBe(3);
  });

  it("moves a player to the end of a higher tier", () => {
    const result = appendPlayerToTier(containers, "3", "A", "S");

    expect(ids(result)).toEqual({
      S: ["1", "2", "3"],
      A: [],
      unranked: ["4"],
    });
    expect(computeGlobalRank(result, ["S", "A"], "S", 2)).toBe(3);
  });

  it("adds an unranked player to the end of a tier", () => {
    const result = appendPlayerToTier(containers, "4", "unranked", "S");

    expect(ids(result)).toEqual({
      S: ["1", "2", "4"],
      A: ["3"],
      unranked: [],
    });
  });

  it("moves a player to the end of their own tier", () => {
    const result = appendPlayerToTier(containers, "1", "S", "S");

    expect(ids(result)).toEqual({ S: ["2", "1"], A: ["3"], unranked: ["4"] });
  });

  it("returns the same object when the player isn't in the source", () => {
    expect(appendPlayerToTier(containers, "3", "S", "A")).toBe(containers);
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

describe("withForcedRows", () => {
  const players = [
    { sleeperId: "1", fullName: "One" },
    { sleeperId: "2", fullName: "Two" },
    { sleeperId: "3", fullName: "Three" },
  ];

  it("returns the visible rows unchanged when there is no active drag", () => {
    const visible = [{ index: 0, start: 0 }];
    expect(withForcedRows(visible, players, [undefined])).toEqual(visible);
  });

  it("returns the visible rows unchanged when the active item is already visible", () => {
    const visible = [
      { index: 0, start: 0 },
      { index: 1, start: 36 },
    ];
    expect(withForcedRows(visible, players, ["2"])).toEqual(visible);
  });

  it("adds the active item's row when it has scrolled out of the visible window", () => {
    const visible = [{ index: 0, start: 0 }];
    const result = withForcedRows(visible, players, ["3"]);
    expect(result).toEqual([
      { index: 0, start: 0 },
      { index: 2, start: 72 },
    ]);
  });

  it("ignores an active id that does not belong to this container", () => {
    const visible = [{ index: 0, start: 0 }];
    expect(withForcedRows(visible, players, ["not-in-this-tier"])).toEqual(
      visible,
    );
  });
  it("adds every kept row that has scrolled out, in index order", () => {
    const players4 = [...players, { sleeperId: "4", fullName: "Four" }];
    const visible = [{ index: 1, start: 36 }];
    expect(withForcedRows(visible, players4, ["4", "1"])).toEqual([
      { index: 0, start: 0 },
      { index: 1, start: 36 },
      { index: 3, start: 108 },
    ]);
  });
});

describe("stepPlayer", () => {
  const tierOrder = ["S", "A"];
  const player = (sleeperId: string, position = "RB") => ({
    sleeperId,
    fullName: `Player ${sleeperId}`,
    position,
  });
  const containers: Containers = {
    S: [player("1"), player("2", "WR"), player("3")],
    A: [player("4"), player("5")],
    unranked: [player("6")],
  };
  const ids = (result: Containers, tier: string) =>
    result[tier].map((p) => p.sleeperId);

  it("moves a player one slot up or down within their tier", () => {
    const up = stepPlayer(containers, tierOrder, "2", "up");
    expect(up && ids(up.containers, "S")).toEqual(["2", "1", "3"]);
    expect(up).toMatchObject({ tier: "S", index: 0 });

    const down = stepPlayer(containers, tierOrder, "2", "down");
    expect(down && ids(down.containers, "S")).toEqual(["1", "3", "2"]);
    expect(down).toMatchObject({ tier: "S", index: 2 });
  });

  it("crosses into the start of the next tier from the bottom of a tier", () => {
    const result = stepPlayer(containers, tierOrder, "3", "down");
    expect(result && ids(result.containers, "S")).toEqual(["1", "2"]);
    expect(result && ids(result.containers, "A")).toEqual(["3", "4", "5"]);
    expect(result).toMatchObject({ tier: "A", index: 0 });
  });

  it("crosses into the end of the previous tier from the top of a tier", () => {
    const result = stepPlayer(containers, tierOrder, "4", "up");
    expect(result && ids(result.containers, "S")).toEqual(["1", "2", "3", "4"]);
    expect(result && ids(result.containers, "A")).toEqual(["5"]);
    expect(result).toMatchObject({ tier: "S", index: 3 });
  });

  it("returns null at either end of the ranking", () => {
    expect(stepPlayer(containers, tierOrder, "1", "up")).toBeNull();
    expect(stepPlayer(containers, tierOrder, "5", "down")).toBeNull();
  });

  it("moves a player to the top or bottom of their tier", () => {
    const top = stepPlayer(containers, tierOrder, "3", "top");
    expect(top && ids(top.containers, "S")).toEqual(["3", "1", "2"]);
    expect(top).toMatchObject({ tier: "S", index: 0 });

    const bottom = stepPlayer(containers, tierOrder, "1", "bottom");
    expect(bottom && ids(bottom.containers, "S")).toEqual(["2", "3", "1"]);
    expect(bottom).toMatchObject({ tier: "S", index: 2 });

    expect(stepPlayer(containers, tierOrder, "1", "top")).toBeNull();
    expect(stepPlayer(containers, tierOrder, "3", "bottom")).toBeNull();
  });

  it("steps over rows hidden by a filter", () => {
    const onlyRbs = (p: { position?: string }) => p.position === "RB";
    const down = stepPlayer(containers, tierOrder, "1", "down", onlyRbs);
    expect(down && ids(down.containers, "S")).toEqual(["2", "3", "1"]);

    const up = stepPlayer(containers, tierOrder, "3", "up", onlyRbs);
    expect(up && ids(up.containers, "S")).toEqual(["3", "1", "2"]);
  });

  it("returns null for an unranked player", () => {
    expect(stepPlayer(containers, tierOrder, "6", "up")).toBeNull();
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

describe("filterPlayers", () => {
  const players = [
    { sleeperId: "1", fullName: "Josh Allen", team: "BUF", position: "QB" },
    { sleeperId: "2", fullName: "Josh Jacobs", team: "GB", position: "RB" },
    { sleeperId: "3", fullName: "James Cook", team: "BUF", position: "RB" },
  ];

  it("returns the same array when no filter is active", () => {
    expect(filterPlayers(players, [], "")).toBe(players);
  });

  it("applies the position filter and the name search together", () => {
    const result = filterPlayers(players, ["RB"], "josh");
    expect(result.map((p) => p.sleeperId)).toEqual(["2"]);
  });
});
