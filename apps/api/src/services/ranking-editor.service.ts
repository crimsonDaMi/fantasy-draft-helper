import { PlayerFlag } from "../domain/player-flag.js";
import { isFantasyPosition } from "../domain/ranking.js";
import { PlayerMatch } from "../domain/player-match.js";
import { Player } from "../domain/player.js";
import { RankingTier } from "../domain/ranking-tier.js";
import { RankingRepository } from "../repositories/ranking.repository.js";
import { withLivePlayer } from "../utils/with-live-player.js";
import { ConflictError, NotFoundError } from "../utils/domain-errors.js";
import { isFantasyRelevantPlayer } from "../utils/is-fantasy-relevant-player.js";
import { PlayerService } from "./player.service.js";

/** Most relevant first by Sleeper's search rank; players without one
 * last, in their original order. */
function bySearchRank(a: Player, b: Player): number {
  if (a.searchRank === undefined || b.searchRank === undefined) {
    return (
      Number(a.searchRank === undefined) - Number(b.searchRank === undefined)
    );
  }

  return a.searchRank - b.searchRank;
}

export class RankingEditorService {
  constructor(
    private readonly repository: RankingRepository,
    private readonly playerService: PlayerService,
  ) {}

  async movePlayer(
    rankingId: string,
    userId: string,
    sleeperId: string,
    targetRank: number,
    targetTier: string,
  ): Promise<PlayerMatch[]> {
    this.assertOwnership(rankingId, userId);

    const tierExists = this.repository
      .getTiers(rankingId)
      .some((tier) => tier.label === targetTier);

    if (!tierExists) {
      throw new NotFoundError("Tier was not found", "TIER_NOT_FOUND");
    }

    const newMatch = this.repository.hasPlayer(rankingId, sleeperId)
      ? undefined
      : await this.matchForPlayer(sleeperId, targetTier, "SLEEPER_ID");

    return this.withLiveStatus(
      this.repository.movePlayer(
        rankingId,
        sleeperId,
        targetRank,
        targetTier,
        newMatch,
      ),
    );
  }

  /**
   * Resolves an unmatched or ambiguous import row (at `rank`, counting
   * every row) to the chosen player, at the same position. `playerName`
   * is the row's name as the client last saw it, guarding against acting
   * on a row that has moved since.
   */
  async resolveUnmatchedRow(
    rankingId: string,
    userId: string,
    rank: number,
    playerName: string,
    sleeperId: string,
  ): Promise<PlayerMatch[]> {
    this.assertOwnership(rankingId, userId);
    const row = this.findUnmatchedRow(rankingId, userId, rank, playerName);

    if (this.repository.hasPlayer(rankingId, sleeperId)) {
      throw new ConflictError(
        "That player is already in this ranking",
        "PLAYER_ALREADY_RANKED",
      );
    }

    const resolved = await this.matchForPlayer(
      sleeperId,
      row.ranking.tier,
      "MANUAL",
    );

    return this.withLiveStatus(
      this.repository.replaceUnmatchedRow(rankingId, rank, resolved),
    );
  }

  /** Deletes an unmatched or ambiguous import row; see
   * `resolveUnmatchedRow` for `rank` and `playerName`. */
  removeUnmatchedRow(
    rankingId: string,
    userId: string,
    rank: number,
    playerName: string,
  ): PlayerMatch[] {
    this.assertOwnership(rankingId, userId);
    this.findUnmatchedRow(rankingId, userId, rank, playerName);

    return this.withLiveStatus(
      this.repository.replaceUnmatchedRow(rankingId, rank, undefined),
    );
  }

  removePlayer(
    rankingId: string,
    userId: string,
    sleeperId: string,
  ): PlayerMatch[] {
    this.assertOwnership(rankingId, userId);

    return this.withLiveStatus(
      this.repository.removePlayer(rankingId, sleeperId),
    );
  }

  insertTier(
    rankingId: string,
    userId: string,
    position: number,
  ): RankingTier[] {
    this.assertOwnership(rankingId, userId);

    return this.repository.insertTier(rankingId, position);
  }

  removeTier(
    rankingId: string,
    userId: string,
    position: number,
  ): RankingTier[] {
    this.assertOwnership(rankingId, userId);

    return this.repository.removeTier(rankingId, position);
  }

  /**
   * Current, fantasy-relevant players not part of this ranking, most
   * relevant first (Sleeper's search rank; players without one last) —
   * the pool shown in the editor's "unranked" side panel.
   */
  async getUnrankedPlayers(
    rankingId: string,
    userId: string,
  ): Promise<Player[]> {
    this.assertOwnership(rankingId, userId);

    await this.playerService.ensurePlayersLoaded();

    const rankedSleeperIds = new Set(
      this.repository
        .getMatches(rankingId, userId)
        .map((match) => match.player?.sleeperId)
        .filter((sleeperId): sleeperId is string => sleeperId !== undefined),
    );

    const now = Date.now();

    return this.playerService
      .getAllPlayers()
      .filter(
        (player) =>
          isFantasyRelevantPlayer(player, now) &&
          !rankedSleeperIds.has(player.sleeperId),
      )
      .sort(bySearchRank);
  }

  /**
   * Full ranking detail (players in rank order plus the tier list) — the
   * entry state for the ranking editor. Reuses the same repository query
   * as the recommendation flow rather than a second, lighter path.
   */
  async getRanking(
    rankingId: string,
    userId: string,
  ): Promise<{
    players: PlayerMatch[];
    tiers: RankingTier[];
    flags: Record<string, PlayerFlag>;
  }> {
    this.assertOwnership(rankingId, userId);

    // Best effort: with Sleeper unreachable, the editor still opens with
    // the ranking's own player data.
    await this.playerService.ensurePlayersLoaded().catch(() => {});

    return {
      players: this.withLiveStatus(
        this.repository.getMatches(rankingId, userId),
      ),
      tiers: this.repository.getTiers(rankingId),
      flags: this.repository.getFlags(rankingId),
    };
  }

  /** Flags a ranked player (watch/avoid), or clears the flag. Returns the
   * ranking's flags after the change. */
  setFlag(
    rankingId: string,
    userId: string,
    sleeperId: string,
    flag: PlayerFlag | undefined,
  ): Record<string, PlayerFlag> {
    this.assertOwnership(rankingId, userId);
    this.assertRanked(rankingId, sleeperId);

    this.repository.setFlag(rankingId, sleeperId, flag);

    return this.repository.getFlags(rankingId);
  }

  /** Sets a ranked player's note, or clears it with `undefined`. */
  setNote(
    rankingId: string,
    userId: string,
    sleeperId: string,
    note: string | undefined,
  ): void {
    this.assertOwnership(rankingId, userId);
    this.assertRanked(rankingId, sleeperId);

    this.repository.setNote(rankingId, sleeperId, note);
  }

  /** A ranking entry for a player chosen in the editor, named after the
   * Sleeper player. `rank` is a placeholder; the repository renumbers. */
  private async matchForPlayer(
    sleeperId: string,
    tier: string | undefined,
    method: PlayerMatch["method"],
  ): Promise<PlayerMatch> {
    await this.playerService.ensurePlayersLoaded();
    const player = this.playerService.getPlayerById(sleeperId);

    if (!player) {
      throw new NotFoundError("Player was not found", "PLAYER_NOT_FOUND");
    }

    return {
      ranking: {
        rank: 0,
        playerName: player.fullName,
        team: player.team,
        position:
          player.position && isFantasyPosition(player.position)
            ? player.position
            : undefined,
        sleeperPlayerId: player.sleeperId,
        tier,
      },
      player,
      method,
    };
  }

  private findUnmatchedRow(
    rankingId: string,
    userId: string,
    rank: number,
    playerName: string,
  ): PlayerMatch {
    const row = this.repository.getMatches(rankingId, userId)[rank - 1];

    if (!row || row.player) {
      throw new NotFoundError(
        "No unmatched row at this rank",
        "UNMATCHED_ROW_NOT_FOUND",
      );
    }

    if (row.ranking.playerName !== playerName) {
      throw new ConflictError(
        "The ranking changed since it was loaded. Reload and try again.",
        "ROW_CHANGED",
      );
    }

    return row;
  }

  private assertRanked(rankingId: string, sleeperId: string): void {
    if (!this.repository.hasPlayer(rankingId, sleeperId)) {
      throw new NotFoundError(
        "Player is not part of this ranking",
        "PLAYER_NOT_RANKED",
      );
    }
  }

  private withLiveStatus(matches: PlayerMatch[]): PlayerMatch[] {
    return matches.map((match) =>
      withLivePlayer(match, (sleeperId) =>
        this.playerService.getPlayerById(sleeperId),
      ),
    );
  }

  private assertOwnership(rankingId: string, userId: string): void {
    if (!this.repository.hasRanking(rankingId, userId)) {
      throw new NotFoundError("Ranking was not found", "RANKING_NOT_FOUND");
    }
  }
}
