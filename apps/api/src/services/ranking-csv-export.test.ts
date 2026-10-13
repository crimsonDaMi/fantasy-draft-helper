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
      bye: 7,
      note: 'New OC, "target share" up\nInjury risk',
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
      "rank,player,position,team,tier,player_id,bye,notes\n" +
        '1,Player One,QB,BUF,S,1,7,"New OC, ""target share"" up\nInjury risk"\n' +
        '2,"Player ""Two"", Jr.",,,A,,,\n',
    );
  });

  it("writes only the header for an empty ranking", () => {
    expect(toRankingCsv([])).toBe(
      "rank,player,position,team,tier,player_id,bye,notes\n",
    );
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
        bye: 7,
        note: 'New OC, "target share" up\nInjury risk',
      },
      {
        rank: 2,
        playerName: 'Player "Two", Jr.',
        position: undefined,
        team: undefined,
        sleeperPlayerId: undefined,
        tier: "A",
        bye: undefined,
        note: undefined,
      },
    ]);
  });
});
