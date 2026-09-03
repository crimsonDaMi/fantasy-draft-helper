import {
  describe,
  expect,
  it,
} from "vitest";

import {
  RankingCsvService,
} from "./ranking-csv.service.js";

import {
  RankingImportService,
} from "./ranking-import.service.js";

describe(
  "RankingImportService",

  () => {
    it(
      "imports the example ranking CSV",

      () => {
        const csvService =
          new RankingCsvService();

        const matchingService = {
          matchRankings: () => [],
        };

        const service =
          new RankingImportService(
            csvService,

            matchingService as never,
          );

        const result =
          service.importCsv(`
player_id,Rank,Name,Team,Position,Tier,Expert Rank
9221,1,Jahmyr Gibbs,DET,RB,S,1.13
9509,2,Bijan Robinson,ATL,RB,S,1.88
7564,3,Ja'Marr Chase,CIN,WR,S,3.00
9493,4,Puka Nacua,LAR,WR,S,4.00
11604,20,Brock Bowers,LV,TE,C,20.88
4984,37,Josh Allen,BUF,QB,D,38.50
`);

        expect(
          result.importResult.errors,
        ).toHaveLength(0);

        expect(
          result.importResult.rankings,
        ).toHaveLength(6);

        expect(
          result.importResult.rankings[5],
        ).toMatchObject({
          rank: 37,

          playerName:
            "Josh Allen",

          position: "QB",
        });
      },
    );
  },
);