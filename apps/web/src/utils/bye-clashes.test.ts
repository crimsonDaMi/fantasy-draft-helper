import { describe, expect, it } from "vitest";

import type { ApiDraftPick } from "../types/api";
import { byeClashes } from "./bye-clashes";

function pick(
  pickNo: number,
  position: string,
  bye: number | undefined,
): ApiDraftPick {
  return {
    pickNo,
    playerId: String(pickNo),
    playerName: `Player ${pickNo}`,
    position,
    bye,
  };
}

describe("byeClashes", () => {
  it("lists weeks with several starters on bye, ignoring the bench", () => {
    const clashes = byeClashes(
      [
        pick(1, "RB", 7),
        pick(2, "WR", 7),
        pick(3, "QB", 9),
        pick(4, "WR", 9),
        pick(5, "RB", 7), // bench: the RB slot is full
        pick(6, "TE", 9),
      ],
      { QB: 1, RB: 1, WR: 2, TE: 1, BN: 5 },
    );

    expect(clashes).toEqual([
      { week: 7, players: ["Player 1", "Player 2"] },
      { week: 9, players: ["Player 3", "Player 4", "Player 6"] },
    ]);
  });

  it("finds nothing without bye weeks", () => {
    expect(
      byeClashes([pick(1, "RB", undefined), pick(2, "WR", undefined)], {
        RB: 1,
        WR: 1,
      }),
    ).toEqual([]);
  });
});
