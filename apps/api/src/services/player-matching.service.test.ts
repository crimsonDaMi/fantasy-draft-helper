import { describe, expect, it } from "vitest";

import { PlayerMatchingService } from "./player-matching.service.js";

describe("PlayerMatchingService", () => {
  const players = [
    {
      sleeperId: "9221",
      fullName: "Jahmyr Gibbs",
      team: "DET",
      position: "RB",
      active: true,
      fantasyPositions: ["RB"],
    },
  ];

  const playerService = {
    getPlayerById: (id: string) =>
      players.find((player) => player.sleeperId === id),
    findPlayersByName: (name: string) =>
      name === "Jahmyr Gibbs" ? players : [],
  };

  const service = new PlayerMatchingService(playerService as never);

  it("matches by Sleeper ID", () => {
    const result = service.matchRanking({
      rank: 1,
      playerName: "Jahmyr Gibbs",
      team: "DET",
      position: "RB",
      sleeperPlayerId: "9221",
    });

    expect(result.method).toBe("SLEEPER_ID");

    expect(result.player?.fullName).toBe("Jahmyr Gibbs");
  });

  it("matches by name when ID is absent", () => {
    const result = service.matchRanking({
      rank: 1,
      playerName: "Jahmyr Gibbs",
      team: "DET",
      position: "RB",
    });

    expect(result.method).toBe("NAME_POSITION_TEAM");
  });

  it("returns NONE when no player matches", () => {
    const result = service.matchRanking({
      rank: 1,
      playerName: "Unknown Player",
      team: "XXX",
      position: "QB",
    });

    expect(result.method).toBe("NONE");
  });

  it("matches by name and team when position is absent", () => {
    const teamPlayers = [
      {
        sleeperId: "1",
        fullName: "Shared Player",
        team: "BUF",
        position: "WR",
        active: true,
        fantasyPositions: ["WR"],
      },
      {
        sleeperId: "2",
        fullName: "Shared Player",
        team: "MIA",
        position: "WR",
        active: true,
        fantasyPositions: ["WR"],
      },
    ];

    const teamPlayerService = {
      getPlayerById: () => undefined,
      findPlayersByName: () => teamPlayers,
    };

    const teamService = new PlayerMatchingService(teamPlayerService as never);

    const result = teamService.matchRanking({
      rank: 1,
      playerName: "Shared Player",
      team: "MIA",
    });

    expect(result.method).toBe("NAME_TEAM");

    expect(result.player?.sleeperId).toBe("2");
  });

  describe("team defenses", () => {
    // Shaped like Sleeper's /players/nfl entries: the ID is the team
    // abbreviation and the name is built from first_name + last_name.
    const defenses = [
      {
        sleeperId: "KC",
        fullName: "Kansas City Chiefs",
        team: "KC",
        position: "DEF",
        active: true,
        fantasyPositions: ["DEF"],
      },
      {
        sleeperId: "JAX",
        fullName: "Jacksonville Jaguars",
        team: "JAX",
        position: "DEF",
        active: true,
        fantasyPositions: ["DEF"],
      },
      {
        sleeperId: "4046",
        fullName: "Test Quarterback",
        team: "KC",
        position: "QB",
        active: true,
        fantasyPositions: ["QB"],
      },
    ];

    const defenseService = new PlayerMatchingService({
      getPlayerById: (id: string) =>
        defenses.find((player) => player.sleeperId === id),
      findPlayersByName: (name: string) =>
        defenses.filter((player) => player.fullName === name),
    } as never);

    it("matches the full team name by name", () => {
      const result = defenseService.matchRanking({
        rank: 1,
        playerName: "Kansas City Chiefs",
        team: "KC",
        position: "DEF",
      });

      expect(result.method).toBe("NAME_POSITION_TEAM");

      expect(result.player?.sleeperId).toBe("KC");
    });

    it("matches a short name by team", () => {
      const result = defenseService.matchRanking({
        rank: 1,
        playerName: "Chiefs D/ST",
        team: "KC",
        position: "DEF",
      });

      expect(result.method).toBe("TEAM_DEFENSE");

      expect(result.player?.sleeperId).toBe("KC");
    });

    it("maps export team abbreviations to Sleeper's", () => {
      const result = defenseService.matchRanking({
        rank: 1,
        playerName: "Jaguars",
        team: "JAC",
        position: "DEF",
      });

      expect(result.method).toBe("TEAM_DEFENSE");

      expect(result.player?.sleeperId).toBe("JAX");
    });

    it("returns NONE for a short name without a team", () => {
      const result = defenseService.matchRanking({
        rank: 1,
        playerName: "Chiefs D/ST",
        position: "DEF",
      });

      expect(result.method).toBe("NONE");
    });

    it("doesn't match other positions by team", () => {
      const result = defenseService.matchRanking({
        rank: 1,
        playerName: "Unknown Player",
        team: "KC",
        position: "QB",
      });

      expect(result.method).toBe("NONE");
    });
  });
});
