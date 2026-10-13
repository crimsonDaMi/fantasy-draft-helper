import { ADP_FORMAT_LABELS, AdpColumn } from "../domain/adp-format.js";
import { PlayerMatch } from "../domain/player-match.js";
import { Player } from "../domain/player.js";
import { FantasyPosition, isFantasyPosition } from "../domain/ranking.js";
import { adpTiers } from "../utils/adp-tiers.js";
import { AdpService } from "./adp.service.js";
import { PlayerService } from "./player.service.js";
import { RankingStoreService } from "./ranking-store.service.js";

/** The player's position, or for one whose position isn't a fantasy one
 * (a two-way DB/WR, a fullback) the first fantasy position Sleeper lists. */
function fantasyPositionOf(player: Player): FantasyPosition | undefined {
  return [player.position, ...player.fantasyPositions].find(
    (position): position is FantasyPosition =>
      position !== undefined && isFantasyPosition(position),
  );
}

export class AdpRankingService {
  constructor(
    private readonly adpService: Pick<AdpService, "getSnapshot">,
    private readonly playerService: Pick<
      PlayerService,
      "ensurePlayersLoaded" | "getPlayerById"
    >,
    private readonly rankingStoreService: Pick<
      RankingStoreService,
      "createRanking"
    >,
  ) {}

  /**
   * Saves a new ranking of every ADP player Sleeper knows with a fantasy
   * position, in ADP order, split into tiers at the natural breaks in
   * their ADP values (see `adpTiers`).
   * The sheet is keyed by Sleeper ID, so every row is matched. Returns
   * undefined, saving nothing, when there's no ADP data for the column
   * (the sheet couldn't be reached and nothing was loaded before).
   */
  async createFromAdp(
    userId: string,
    column: AdpColumn,
  ): Promise<string | undefined> {
    const adpBySleeperId = await this.adpService.getSnapshot(column);

    if (adpBySleeperId.size === 0) {
      return undefined;
    }

    await this.playerService.ensurePlayersLoaded();

    const ranked = [...adpBySleeperId]
      .sort(([, a], [, b]) => a - b)
      .flatMap(([sleeperId, adp]) => {
        const player = this.playerService.getPlayerById(sleeperId);
        const position = player && fantasyPositionOf(player);

        return player && position ? [{ player, position, adp }] : [];
      });
    const tiers = adpTiers(ranked.map(({ adp }) => adp));

    const matches = ranked.map(({ player, position }, index): PlayerMatch => ({
      ranking: {
        rank: index + 1,
        playerName: player.fullName,
        team: player.team,
        position,
        sleeperPlayerId: player.sleeperId,
        tier: tiers[index],
      },
      player,
      method: "SLEEPER_ID",
    }));

    return this.rankingStoreService.createRanking(
      matches,
      userId,
      `Sleeper ADP (${ADP_FORMAT_LABELS[column]})`,
    );
  }
}
