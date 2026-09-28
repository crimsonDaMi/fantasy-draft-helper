import { describe, expect, it } from "vitest";

import { RankingCsvService } from "./ranking-csv.service.js";

describe("RankingCsvService", () => {
  const service = new RankingCsvService();

  it("parses valid rankings", () => {
    const result = service.parse(`
player_id,Rank,Name,Team,Position,Tier,Expert Rank
9221,1,Jahmyr Gibbs,DET,RB,S,1.13
9509,2,Bijan Robinson,ATL,RB,S,1.88
7564,3,Ja'Marr Chase,CIN,WR,S,3.00
`);

    expect(result.errors).toHaveLength(0);

    expect(result.rankings).toHaveLength(3);

    expect(result.rankings[0]).toEqual({
      rank: 1,
      playerName: "Jahmyr Gibbs",
      team: "DET",
      position: "RB",
      sleeperPlayerId: "9221",
      tier: "S",
    });
  });

  it("supports optional Tier", () => {
    const result = service.parse(`
player_id,Rank,Name,Team,Position
9221,1,Jahmyr Gibbs,DET,RB
`);

    expect(result.errors).toHaveLength(0);

    expect(result.rankings[0]?.tier).toBeUndefined();
  });

  it("supports Kickers", () => {
    const result = service.parse(`
Rank,Name,Team,Position
1,Example Kicker,KC,K
`);

    expect(result.rankings[0]?.position).toBe("K");
  });

  it("supports Defenses", () => {
    const result = service.parse(`
Rank,Name,Team,Position
1,Example Defense,BUF,DEF
`);

    expect(result.rankings[0]?.position).toBe("DEF");
  });

  it("rejects invalid positions", () => {
    const result = service.parse(`
Rank,Name,Team,Position
1,Example Player,BUF,XYZ
`);

    expect(result.errors).toHaveLength(1);
  });

  it("parses canonical headers with optional metadata", () => {
    const result = service.parse(`
rank,player,position,team,tier,notes
1,Ja'Marr Chase,WR,CIN,1,Target share leader
2,Name Only,,,,
`);

    expect(result.errors).toHaveLength(0);
    expect(result.rankings).toEqual([
      {
        rank: 1,
        playerName: "Ja'Marr Chase",
        team: "CIN",
        position: "WR",
        tier: "1",
        sleeperPlayerId: undefined,
      },
      {
        rank: 2,
        playerName: "Name Only",
        team: undefined,
        position: undefined,
        tier: undefined,
        sleeperPlayerId: undefined,
      },
    ]);
  });

  it("rejects missing required headers", () => {
    const result = service.parse(`
position,team
WR,CIN
`);

    expect(result.rankings).toHaveLength(0);
    expect(result.errors[0]?.message).toContain("rank and player");
  });

  it("rejects empty CSV input", () => {
    const result = service.parse("");

    expect(result.rankings).toHaveLength(0);
    expect(result.errors[0]?.message).toContain("header");
  });

  it("reports malformed CSV input", () => {
    const result = service.parse('rank,player\n1,"Unclosed');

    expect(result.rankings).toHaveLength(0);
    expect(result.errors[0]?.message).toContain("Invalid CSV");
  });

  it("accepts a FantasyPros-style export", () => {
    const result =
      service.parse(`\uFEFF"RK","TIERS","PLAYER NAME","TEAM","POS","BYE WEEK","SOS SEASON","ECR VS. ADP"
"1","1","Player One","AAA","WR1","5","3 out of 5 stars","+2"
"2","2","Player Two","BBB","RB12","7","2 out of 5 stars","-1"
"3","9","Team Defense","CCC","DST1","9","",""
`);

    expect(result.errors).toHaveLength(0);

    expect(result.rankings).toEqual([
      {
        rank: 1,
        playerName: "Player One",
        team: "AAA",
        position: "WR",
        sleeperPlayerId: undefined,
        tier: "1",
      },
      {
        rank: 2,
        playerName: "Player Two",
        team: "BBB",
        position: "RB",
        sleeperPlayerId: undefined,
        tier: "2",
      },
      {
        rank: 3,
        playerName: "Team Defense",
        team: "CCC",
        position: "DEF",
        sleeperPlayerId: undefined,
        tier: "9",
      },
    ]);
  });

  it("maps D/ST to DEF and still rejects unknown positions with a rank", () => {
    const result = service.parse(`
rank,player,position
1,Team Defense,D/ST
2,Player Two,LB3
`);

    expect(result.rankings.map((ranking) => ranking.position)).toEqual(["DEF"]);
    expect(result.errors).toEqual([
      { row: 3, message: "Invalid position: LB3" },
    ]);
  });
});
