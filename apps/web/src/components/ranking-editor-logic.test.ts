import { describe, expect, it } from "vitest";

import {
  buildContainers,
  computeGlobalRank,
  findContainer,
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
