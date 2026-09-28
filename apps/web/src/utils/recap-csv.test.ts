import { describe, expect, it } from "vitest";

import { toRecapCsv } from "./recap-csv";

describe("toRecapCsv", () => {
  it("writes one row per pick and quotes fields that need it", () => {
    const csv = toRecapCsv(
      [
        {
          pickNo: 14,
          playerId: "1",
          playerName: 'Player "One", Jr.',
          position: "WR",
          team: "AAA",
          rank: 10,
          tier: "B",
          adp: 12.5,
        },
        { pickNo: 35, playerId: "2" },
      ],
      12,
    );

    expect(csv).toBe(
      [
        "pick,overall,player,position,team,your_rank,tier,adp",
        '2.02,14,"Player ""One"", Jr.",WR,AAA,10,B,12.5',
        "3.11,35,2,,,,,",
        "",
      ].join("\n"),
    );
  });
});
