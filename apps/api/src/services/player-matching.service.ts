import { Player } from "../domain/player.js";
import { PlayerMatch } from "../domain/player-match.js";
import { Ranking } from "../domain/ranking.js";
import { PlayerService } from "./player.service.js";
import { normalizePlayerName } from "../utils/normalize-player-name.js";

// Team abbreviations some ranking exports use where Sleeper's differ.
const SLEEPER_TEAM_ALIASES: Record<string, string> = {
  JAC: "JAX",
  WSH: "WAS",
};

export class PlayerMatchingService {
  constructor(private readonly playerService: PlayerService) {}

  matchRankings(rankings: Ranking[]): PlayerMatch[] {
    return rankings.map((ranking) => this.matchRanking(ranking));
  }

  matchRanking(ranking: Ranking): PlayerMatch {
    const bySleeperId = this.matchBySleeperId(ranking);

    if (bySleeperId) {
      return bySleeperId;
    }

    const byName = this.matchByName(ranking);

    if (byName.method === "NONE") {
      return this.matchTeamDefense(ranking) ?? byName;
    }

    return byName;
  }

  /** Sleeper's team defenses use the team abbreviation as their ID, so a
   * `DEF` row with a team matches even when its name ("Chiefs D/ST")
   * isn't Sleeper's ("Kansas City Chiefs"). */
  private matchTeamDefense(ranking: Ranking): PlayerMatch | undefined {
    if (ranking.position !== "DEF" || !ranking.team) {
      return undefined;
    }

    const player = this.playerService.getPlayerById(
      SLEEPER_TEAM_ALIASES[ranking.team] ?? ranking.team,
    );

    if (player?.position !== "DEF") {
      return undefined;
    }

    return {
      ranking,
      player,
      method: "TEAM_DEFENSE",
    };
  }

  private matchBySleeperId(ranking: Ranking): PlayerMatch | undefined {
    if (!ranking.sleeperPlayerId) {
      return undefined;
    }

    const player = this.playerService.getPlayerById(ranking.sleeperPlayerId);

    if (!player) {
      return undefined;
    }

    return {
      ranking,
      player,
      method: "SLEEPER_ID",
      warnings: this.getIdMatchWarnings(ranking, player),
    };
  }

  /** Narrows the players with the row's name step by step, taking the
   * first step that leaves exactly one. */
  private matchByName(ranking: Ranking): PlayerMatch {
    const candidates = this.playerService.findPlayersByName(ranking.playerName);

    if (candidates.length === 0) {
      return {
        ranking,
        method: "NONE",
      };
    }

    const steps: [PlayerMatch["method"], (player: Player) => boolean][] = [
      [
        "NAME_POSITION_TEAM",
        (player) =>
          player.team === ranking.team && player.position === ranking.position,
      ],
      ["NAME_POSITION", (player) => player.position === ranking.position],
      [
        "NAME_TEAM",
        (player) => ranking.team !== undefined && player.team === ranking.team,
      ],
      ["NAME", () => true],
    ];

    for (const [method, accepts] of steps) {
      const narrowed = candidates.filter(accepts);

      if (narrowed.length === 1) {
        return {
          ranking,
          player: narrowed[0],
          method,
        };
      }
    }

    return {
      ranking,
      method: "AMBIGUOUS",
      candidates,
    };
  }

  private getIdMatchWarnings(
    ranking: Ranking,
    player: Player,
  ): PlayerMatch["warnings"] {
    const metadataMatches =
      normalizePlayerName(ranking.playerName) ===
        normalizePlayerName(player.fullName) &&
      player.team === ranking.team &&
      player.position === ranking.position;

    return metadataMatches ? undefined : ["ID_METADATA_MISMATCH"];
  }
}
