import {
  PositionTierCounts,
  RankedDraftPick,
  Recommendation,
  RecommendationResult,
} from "../domain/recommendation.js";
import { DraftPick } from "../domain/draft.js";
import { FANTASY_POSITIONS } from "../domain/ranking.js";
import { PlayerMatch } from "../domain/player-match.js";
import { Player } from "../domain/player.js";
import { withLiveInjuryStatus } from "../utils/with-live-injury-status.js";
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
): Recommendation["adp"] {
  if (adpValue === undefined) {
    return undefined;
  }

  return { value: adpValue, diff: Math.round((rank - adpValue) * 10) / 10 };
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
    private readonly playerService: Pick<PlayerService, "getPlayerById">,
  ) {}

  async getRecommendations(
    draftId: string,
    rankingId: string,
    userId: string,
    limit: number,
    positions?: string[],
    query?: string,
    showAvoided = false,
  ): Promise<RecommendationResult> {
    const draftState = await this.draftStateService.getDraftState(draftId);

    const draftedPlayerIds = draftState.draftedPlayerIds;

    const matches = this.rankingStoreService.getMatches(userId, rankingId);

    const adpBySleeperId = await this.adpService.getSnapshot();

    const flags = this.rankingStoreService.getFlags(rankingId);

    const matched = matches.filter(hasPlayer);

    const available = matched.filter(
      (match) => !draftedPlayerIds.has(match.player.sleeperId),
    );

    const isAvoided = (match: { player: Player }) =>
      flags[match.player.sleeperId] === "avoid";

    const recommendations = available
      .filter((match) => showAvoided || !isAvoided(match))
      .filter((match) => isInPositions(match.player, positions))
      .filter((match) => matchesQuery(match.player, query))
      .slice(0, limit)
      .map((match) =>
        withLiveInjuryStatus(match, (sleeperId) =>
          this.playerService.getPlayerById(sleeperId),
        ),
      )
      .map((match): Recommendation => ({
        ranking: match.ranking,
        player: match.player,
        flag: flags[match.player.sleeperId],
        adp: adpComparison(
          match.ranking.rank,
          adpBySleeperId.get(match.player.sleeperId),
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
        tier: match?.ranking.tier,
        adp: adpBySleeperId.get(pick.playerId),
      };
    });

    return {
      recommendations,
      draft: draftState.draft,
      picks,
      tierCounts: countRemainingByTier(available),
      avoidedCount: available.filter(isAvoided).length,
      draftedPlayerCount: draftedPlayerIds.size,
      draftStatus: draftState.draft.status,
      totalPicks: draftState.picks.length,
      lastPick: draftState.picks.at(-1),
      lastUpdatedAt: draftState.lastUpdatedAt.toISOString(),
      generatedAt: new Date().toISOString(),
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
