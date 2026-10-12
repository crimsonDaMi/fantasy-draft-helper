import { describe, expect, it, vi } from "vitest";

import { RankingCsvService } from "./ranking-csv.service.js";
import { RankingImportService } from "./ranking-import.service.js";
import { PlayerService } from "./player.service.js";

describe("RankingImportService", () => {
  it("imports the example ranking CSV", async () => {
    const csvService = new RankingCsvService();

    const matchingService = {
      matchRankings: () => [],
    };

    const playerService = {
      ensurePlayersLoaded: vi.fn().mockResolvedValue(undefined),
    } as unknown as PlayerService;

    const service = new RankingImportService(
      csvService,
      matchingService as never,
      playerService as never,
    );

    const result = await service.importCsv(`
player_id,Rank,Name,Team,Position,Tier,Expert Rank
9221,1,Jahmyr Gibbs,DET,RB,S,1.13
9509,2,Bijan Robinson,ATL,RB,S,1.88
7564,3,Ja'Marr Chase,CIN,WR,S,3.00
9493,4,Puka Nacua,LAR,WR,S,4.00
11604,20,Brock Bowers,LV,TE,C,20.88
4984,37,Josh Allen,BUF,QB,D,38.50
`);

    expect(result.importResult.errors).toHaveLength(0);

    expect(result.importResult.rankings).toHaveLength(6);

    expect(result.importResult.rankings[5]).toMatchObject({
      rank: 37,
      playerName: "Josh Allen",
      position: "QB",
    });
  });

  it("loads players before matching rankings", async () => {
    const csvService = new RankingCsvService();

    const matchingService = {
      matchRankings: () => [],
    };

    const playerService = {
      ensurePlayersLoaded: vi.fn().mockResolvedValue(undefined),
    } as unknown as PlayerService;

    const service = new RankingImportService(
      csvService,
      matchingService as never,
      playerService as never,
    );

    await service.importCsv(`
player_id,Rank,Name,Team,Position,Tier,Expert Rank
9221,1,Jahmyr Gibbs,DET,RB,S,1.13
9509,2,Bijan Robinson,ATL,RB,S,1.88
7564,3,Ja'Marr Chase,CIN,WR,S,3.00
9493,4,Puka Nacua,LAR,WR,S,4.00
11604,20,Brock Bowers,LV,TE,C,20.88
4984,37,Josh Allen,BUF,QB,D,38.50
`);

    expect(playerService.ensurePlayersLoaded).toHaveBeenCalledTimes(1);
  });

  it("keeps a player's first row and leaves a duplicate unmatched", async () => {
    const player = {
      sleeperId: "9221",
      fullName: "Player One",
      active: true,
      fantasyPositions: ["RB"],
    };
    const matchingService = {
      matchRankings: (rankings: { rank: number; playerName: string }[]) =>
        rankings.map((ranking) => ({ ranking, player, method: "SLEEPER_ID" })),
    };
    const service = new RankingImportService(
      new RankingCsvService(),
      matchingService as never,
      {
        ensurePlayersLoaded: vi.fn().mockResolvedValue(undefined),
      } as never,
    );

    const result = await service.importCsv(`
player_id,Rank,Name,Team,Position
9221,1,Player One,DET,RB
9221,2,Player One,DET,RB
`);

    expect(result.matches[0]).toMatchObject({ player, method: "SLEEPER_ID" });
    expect(result.matches[1]).toEqual({
      ranking: expect.objectContaining({ rank: 2 }),
      method: "NONE",
      candidates: [player],
      warnings: ["DUPLICATE_PLAYER"],
    });
    expect(result.summary).toMatchObject({ matched: 1, unmatched: 1 });
  });
});
