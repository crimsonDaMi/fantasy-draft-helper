import { describe, expect, it, vi } from "vitest";

import { AdpRankingService } from "./adp-ranking.service.js";

const TEST_USER_ID = "test-user";

const players: Record<
  string,
  { position?: string; team?: string; fantasyPositions: string[] }
> = {
  "1": { position: "WR", team: "KC", fantasyPositions: ["WR"] },
  "2": { position: "QB", team: "BUF", fantasyPositions: ["QB"] },
  "3": { position: "DEF", team: "SF", fantasyPositions: ["DEF"] },
  // No fantasy position at all, so it can't be ranked.
  "4": { position: "OL", team: "DET", fantasyPositions: ["OL"] },
  // A two-way player: ranked at his fantasy position.
  "5": { position: "DB", team: "JAX", fantasyPositions: ["DB", "WR"] },
};

function createService(snapshot: Map<string, number>) {
  const createRanking = vi.fn(() => "ranking-1");
  const ensurePlayersLoaded = vi.fn(async () => {});

  const service = new AdpRankingService(
    { getSnapshot: async () => snapshot },
    {
      ensurePlayersLoaded,
      getPlayerById: (sleeperId: string) =>
        players[sleeperId] && {
          sleeperId,
          fullName: `Player ${sleeperId}`,
          active: true,
          ...players[sleeperId],
        },
    },
    { createRanking },
  );

  return { service, createRanking, ensurePlayersLoaded };
}

describe("AdpRankingService", () => {
  it("ranks every known ADP player in ADP order, matched by Sleeper ID, tiered by ADP", async () => {
    const { service, createRanking } = createService(
      new Map([
        ["3", 140.2],
        ["1", 2.5],
        ["4", 50],
        // Missing from Sleeper's player data.
        ["99", 10],
        ["2", 12.1],
        ["5", 30],
      ]),
    );

    const rankingId = await service.createFromAdp(
      TEST_USER_ID,
      "Redraft SF ADP",
    );

    expect(rankingId).toBe("ranking-1");
    expect(createRanking).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          ranking: {
            rank: 1,
            playerName: "Player 1",
            team: "KC",
            position: "WR",
            sleeperPlayerId: "1",
            tier: "S",
          },
          player: expect.objectContaining({ sleeperId: "1" }),
          method: "SLEEPER_ID",
        }),
        expect.objectContaining({
          ranking: expect.objectContaining({
            rank: 2,
            sleeperPlayerId: "2",
            tier: "A",
          }),
        }),
        expect.objectContaining({
          ranking: expect.objectContaining({
            rank: 3,
            sleeperPlayerId: "5",
            position: "WR",
            tier: "B",
          }),
        }),
        expect.objectContaining({
          ranking: expect.objectContaining({
            rank: 4,
            sleeperPlayerId: "3",
            tier: "C",
          }),
        }),
      ],
      TEST_USER_ID,
      "Sleeper ADP (SF)",
    );
  });

  it("saves nothing when there's no ADP data", async () => {
    const { service, createRanking, ensurePlayersLoaded } = createService(
      new Map(),
    );

    await expect(
      service.createFromAdp(TEST_USER_ID, "Redraft PPR ADP"),
    ).resolves.toBeUndefined();
    expect(createRanking).not.toHaveBeenCalled();
    expect(ensurePlayersLoaded).not.toHaveBeenCalled();
  });
});
