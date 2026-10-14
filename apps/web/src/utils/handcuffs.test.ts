import { describe, expect, it } from "vitest";

import type { ApiDepthChart, ApiDraftPick } from "../types/api";
import { handcuffedRbs } from "./handcuffs";

const pick = (
  playerId: string,
  team?: string,
  depthChart?: ApiDepthChart,
): ApiDraftPick => ({
  pickNo: Number(playerId),
  playerId,
  playerName: `Player ${playerId}`,
  position: "RB",
  team,
  depthChart,
});

const player = (team?: string, depthChart?: ApiDepthChart) => ({
  sleeperId: "99",
  fullName: "Player 99",
  position: "RB",
  team,
  depthChart,
});

const rb = (order: number): ApiDepthChart => ({ position: "RB", order });

describe("handcuffedRbs", () => {
  it("marks only the next RB behind a drafted RB on the same team", () => {
    const myPicks = [pick("1", "AAA", rb(1)), pick("2", "BBB", rb(2))];

    expect(handcuffedRbs(player("AAA", rb(2)), myPicks)).toEqual(["Player 1"]);
    expect(handcuffedRbs(player("BBB", rb(3)), myPicks)).toEqual(["Player 2"]);
    expect(handcuffedRbs(player("AAA", rb(3)), myPicks)).toEqual([]);
    expect(handcuffedRbs(player("AAA", rb(1)), myPicks)).toEqual([]);
    expect(handcuffedRbs(player("CCC", rb(2)), myPicks)).toEqual([]);
  });

  it("ignores other depth chart positions", () => {
    const myPicks = [pick("1", "AAA", { position: "LWR", order: 1 })];

    expect(handcuffedRbs(player("AAA", rb(2)), myPicks)).toEqual([]);
    expect(
      handcuffedRbs(player("AAA", { position: "LWR", order: 2 }), myPicks),
    ).toEqual([]);
  });

  it("never marks players without depth chart data", () => {
    expect(handcuffedRbs(player("AAA"), [pick("1", "AAA", rb(1))])).toEqual([]);
    expect(handcuffedRbs(player("AAA", rb(2)), [pick("1", "AAA")])).toEqual([]);
    expect(
      handcuffedRbs(player(undefined, rb(2)), [pick("1", "AAA", rb(1))]),
    ).toEqual([]);
  });
});
