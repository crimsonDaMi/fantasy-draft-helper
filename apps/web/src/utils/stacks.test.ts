import { describe, expect, it } from "vitest";

import type { ApiDraftPick } from "../types/api";
import { stackPartners } from "./stacks";

const pick = (
  playerId: string,
  position: string,
  team?: string,
): ApiDraftPick => ({
  pickNo: Number(playerId),
  playerId,
  playerName: `Player ${playerId}`,
  position,
  team,
});

const player = (position: string, team?: string) => ({
  sleeperId: "99",
  fullName: "Player 99",
  position,
  team,
});

describe("stackPartners", () => {
  it("pairs a QB with WRs and TEs on the same team, both ways", () => {
    const myPicks = [
      pick("1", "WR", "AAA"),
      pick("2", "TE", "AAA"),
      pick("3", "WR", "BBB"),
      pick("4", "QB", "BBB"),
    ];

    expect(stackPartners(player("QB", "AAA"), myPicks)).toEqual([
      "Player 1",
      "Player 2",
    ]);
    expect(stackPartners(player("TE", "BBB"), myPicks)).toEqual(["Player 4"]);
  });

  it("ignores other position pairs", () => {
    const myPicks = [pick("1", "WR", "AAA"), pick("2", "QB", "AAA")];

    expect(stackPartners(player("WR", "CCC"), myPicks)).toEqual([]);
    expect(stackPartners(player("RB", "AAA"), myPicks)).toEqual([]);
    expect(
      stackPartners(player("WR", "AAA"), [pick("1", "WR", "AAA")]),
    ).toEqual([]);
  });

  it("never stacks free agents", () => {
    expect(
      stackPartners(player("QB"), [pick("1", "WR"), pick("2", "TE")]),
    ).toEqual([]);
    expect(stackPartners(player("QB", "AAA"), [pick("1", "WR")])).toEqual([]);
  });
});
