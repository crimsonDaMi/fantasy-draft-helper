import {
  describe,
  expect,
  it,
} from "vitest";

import {
  RankingCsvService,
} from "./ranking-csv.service.js";

describe(
  "RankingCsvService",

  () => {
    const service =
      new RankingCsvService();

    it(
      "parses valid rankings",

      () => {
        const result =
          service.parse(`
player_id,Rank,Name,Team,Position,Tier,Expert Rank
9221,1,Jahmyr Gibbs,DET,RB,S,1.13
9509,2,Bijan Robinson,ATL,RB,S,1.88
7564,3,Ja'Marr Chase,CIN,WR,S,3.00
`);

        expect(
          result.errors,
        ).toHaveLength(0);

        expect(
          result.rankings,
        ).toHaveLength(3);

        expect(
          result.rankings[0],
        ).toEqual({
          rank: 1,

          playerName:
            "Jahmyr Gibbs",

          team: "DET",

          position: "RB",

          sleeperPlayerId:
            "9221",

          tier: "S",
        });
      },
    );

    it(
      "supports optional Tier",

      () => {
        const result =
          service.parse(`
player_id,Rank,Name,Team,Position
9221,1,Jahmyr Gibbs,DET,RB
`);

        expect(
          result.errors,
        ).toHaveLength(0);

        expect(
          result.rankings[0]?.tier,
        ).toBeUndefined();
      },
    );

    it(
      "supports Kickers",

      () => {
        const result =
          service.parse(`
Rank,Name,Team,Position
1,Example Kicker,KC,K
`);

        expect(
          result.rankings[0]?.position,
        ).toBe("K");
      },
    );

    it(
      "supports Defenses",

      () => {
        const result =
          service.parse(`
Rank,Name,Team,Position
1,Example Defense,BUF,DEF
`);

        expect(
          result.rankings[0]?.position,
        ).toBe("DEF");
      },
    );

    it(
      "rejects invalid positions",

      () => {
        const result =
          service.parse(`
Rank,Name,Team,Position
1,Example Player,BUF,XYZ
`);

        expect(
          result.errors,
        ).toHaveLength(1);
      },
    );
  },
);