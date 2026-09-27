import { describe, expect, it } from "vitest";

import { PlayerMatch } from "../domain/player-match.js";
import { RankingCsvService } from "./ranking-csv.service.js";
import { toRankingCsv } from "./ranking-csv-export.js";

const MATCHES: PlayerMatch[] = [
  {
    method: "SLEEPER_ID",
    ranking: {
      rank: 1,
      playerName: "Player One",
      position: "QB",
      team: "BUF",
      sleeperPlayerId: "1",
      tier: "S",
    },
    player: {
      sleeperId: "1",
      fullName: "Player One",
      active: true,
      fantasyPositions: ["QB"],
    },
  },
  {
    method: "NONE",
    ranking: {
      rank: 2,
      playerName: 'Player "Two", Jr.',
      tier: "A",
    },
  },
];

describe("toRankingCsv", () => {
  it("writes the canonical headers and one row per ranked player", () => {
    expect(toRankingCsv(MATCHES)).toBe(
      "rank,player,position,team,tier,player_id\n" +
        "1,Player One,QB,BUF,S,1\n" +
        '2,"Player ""Two"", Jr.",,,A,\n',
    );
  });

  it("writes only the header for an empty ranking", () => {
    expect(toRankingCsv([])).toBe("rank,player,position,team,tier,player_id\n");
  });

  it("round-trips through the CSV importer", () => {
    const result = new RankingCsvService().parse(toRankingCsv(MATCHES));

    expect(result.errors).toEqual([]);
    expect(result.rankings).toEqual([
      {
        rank: 1,
        playerName: "Player One",
        position: "QB",
        team: "BUF",
        sleeperPlayerId: "1",
        tier: "S",
      },
      {
        rank: 2,
        playerName: 'Player "Two", Jr.',
        position: undefined,
        team: undefined,
        sleeperPlayerId: undefined,
        tier: "A",
      },
    ]);
  });
});
