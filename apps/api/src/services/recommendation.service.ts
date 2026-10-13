import {
  PositionTierCounts,
  RankedDraftPick,
  Recommendation,
  RecommendationResult,
} from "../domain/recommendation.js";
import { adpFormatFor } from "../domain/adp-format.js";
import { DraftPick } from "../domain/draft.js";
import { FANTASY_POSITIONS } from "../domain/ranking.js";
import { PlayerMatch } from "../domain/player-match.js";
import { Player } from "../domain/player.js";
import { withLivePlayer } from "../utils/with-live-player.js";
import { normalizePlayerName } from "../utils/normalize-player-name.js";
import { AdpService } from "./adp.service.js";
import { DraftStateService } from "./draft-state.service.js";
import { PlayerService } from "./player.service.js";
import { RankingStoreService } from "./ranking-store.service.js";

function hasPlayer(
  match: PlayerMatch,
): match is PlayerMatch & { player: Player } {
  return match.player !== undefined;
}

/** No filter (undefined or empty) lets every player through. */
function isInPositions(player: Player, positions: string[] | undefined) {
  if (!positions || positions.length === 0) {
    return true;
  }

  return player.position !== undefined && positions.includes(player.position);
}

/** Case-, accent- and punctuation-insensitive substring search on the
 * player's name and team. No query (undefined or blank) matches all. */
function matchesQuery(player: Player, query: string | undefined) {
  const normalizedQuery = query ? normalizePlayerName(query) : "";

  if (normalizedQuery === "") {
    return true;
  }

  const haystack = normalizePlayerName(
    `${player.fullName} ${player.team ?? ""}`,
  );

  return haystack.includes(normalizedQuery);
}

const TIERS_SHOWN_PER_POSITION = 2;

/** The player's ADP and its difference to their rank (`rank - adp`,
 * rounded to one decimal). */
function adpComparison(
  rank: number,
  adpValue: number | undefined,
  positionRank: number | undefined,
): Recommendation["adp"] {
  if (adpValue === undefined) {
    return undefined;
  }

  return {
    value: adpValue,
    diff: Math.round((rank - adpValue) * 10) / 10,
    positionRank,
  };
}

/** Each player's place within their position, in the given order (1 for
 * the first WR, …). Entries without a Sleeper ID still take their place,
 * so unmatched ranking rows keep the numbering true to the ranking. */
function positionRanks(
  entries: { sleeperId?: string; position?: string }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  const ranks = new Map<string, number>();

  for (const { sleeperId, position } of entries) {
    if (!position) {
      continue;
    }

    const count = (counts.get(position) ?? 0) + 1;
    counts.set(position, count);

    if (sleeperId) {
      ranks.set(sleeperId, count);
    }
  }

  return ranks;
}

/** Per position, the first tiers (in ranking order) that still have
 * undrafted players, with how many are left in each. */
function countRemainingByTier(
  available: (PlayerMatch & { player: Player })[],
): PositionTierCounts[] {
  const byPosition = new Map<string, Map<string, number>>();

  for (const match of available) {
    const position = match.player.position ?? match.ranking.position;
    const tier = match.ranking.tier;

    if (!position || !tier) {
      continue;
    }

    const tiers = byPosition.get(position) ?? new Map<string, number>();
    tiers.set(tier, (tiers.get(tier) ?? 0) + 1);
    byPosition.set(position, tiers);
  }

  return FANTASY_POSITIONS.filter((position) => byPosition.has(position)).map(
    (position) => ({
      position,
      tiers: [...byPosition.get(position)!]
        .slice(0, TIERS_SHOWN_PER_POSITION)
        .map(([tier, remaining]) => ({ tier, remaining })),
    }),
  );
}

export class RecommendationService {
  constructor(
    private readonly draftStateService: DraftStateService,
    private readonly rankingStoreService: RankingStoreService,
    private readonly adpService: AdpService,
    private readonly playerService: Pick<
      PlayerService,
      "getPlayerById" | "getCacheUpdatedAt"
    >,
  ) {}

  async getRecommendations(
    draftId: string,
    rankingId: string,
    userId: string,
    limit: number,
    positions?: string[],
    query?: string,
    showAvoided = false,
    rookiesOnly = false,
  ): Promise<RecommendationResult> {
    const draftState = await this.draftStateService.getDraftState(draftId);

    const draftedPlayerIds = draftState.draftedPlayerIds;

    // Live player data for every row, not just the shown ones: filters,
    // search and position ranks read the player's position and name.
    const matches = this.rankingStoreService
      .getRankingMatches(rankingId, userId)
      .map((match) =>
        withLivePlayer(match, (sleeperId) =>
          this.playerService.getPlayerById(sleeperId),
        ),
      );

    const adpFormat = adpFormatFor(draftState.draft);

    const adpBySleeperId = await this.adpService.getSnapshot(adpFormat.column);

    const flags = this.rankingStoreService.getFlags(rankingId);

    const matched = matches.filter(hasPlayer);

    // From the full ranking, so the numbers don't shift as players are
    // drafted or filtered out.
    const positionRankBySleeperId = positionRanks(
      matches.map((match) => ({
        sleeperId: match.player?.sleeperId,
        position: match.player?.position ?? match.ranking.position,
      })),
    );

    const adpPositionRankBySleeperId = positionRanks(
      [...adpBySleeperId]
        .sort(([, a], [, b]) => a - b)
        .map(([sleeperId]) => ({
          sleeperId,
          position: this.playerService.getPlayerById(sleeperId)?.position,
        })),
    );

    const available = matched.filter(
      (match) => !draftedPlayerIds.has(match.player.sleeperId),
    );

    const isAvoided = (match: { player: Player }) =>
      flags[match.player.sleeperId] === "avoid";

    const recommendations = available
      .filter((match) => showAvoided || !isAvoided(match))
      .filter((match) => isInPositions(match.player, positions))
      .filter((match) => matchesQuery(match.player, query))
      .filter((match) => !rookiesOnly || match.player.rookie === true)
      .slice(0, limit)
      .map((match): Recommendation => ({
        ranking: match.ranking,
        player: match.player,
        positionRank: positionRankBySleeperId.get(match.player.sleeperId),
        flag: flags[match.player.sleeperId],
        adp: adpComparison(
          match.ranking.rank,
          adpBySleeperId.get(match.player.sleeperId),
          adpPositionRankBySleeperId.get(match.player.sleeperId),
        ),
      }));

    const matchesBySleeperId = new Map(
      matched.map((match) => [match.player.sleeperId, match] as const),
    );

    const picks = draftState.picks.map((pick): RankedDraftPick => {
      const match = matchesBySleeperId.get(pick.playerId);

      return {
        ...pick,
        playerName: pick.playerName ?? this.playerName(pick, match?.player),
        rank: match?.ranking.rank,
        positionRank: positionRankBySleeperId.get(pick.playerId),
        tier: match?.ranking.tier,
        bye: match?.ranking.bye,
        adp: adpBySleeperId.get(pick.playerId),
        adpPositionRank: adpPositionRankBySleeperId.get(pick.playerId),
      };
    });

    return {
      recommendations,
      draft: draftState.draft,
      adpFormat: adpFormat.label,
      picks,
      tierCounts: countRemainingByTier(available),
      avoidedCount: available.filter(isAvoided).length,
      draftedPlayerCount: draftedPlayerIds.size,
      draftStatus: draftState.draft.status,
      totalPicks: draftState.picks.length,
      lastPick: draftState.picks.at(-1),
      lastUpdatedAt: draftState.lastUpdatedAt.toISOString(),
      generatedAt: new Date().toISOString(),
      playersUpdatedAt: this.playerService.getCacheUpdatedAt()?.toISOString(),
    };
  }

  /** Fallback when Sleeper's pick metadata carries no name. */
  private playerName(pick: DraftPick, rankedPlayer?: Player) {
    return (
      rankedPlayer?.fullName ??
      this.playerService.getPlayerById(pick.playerId)?.fullName
    );
  }
}
