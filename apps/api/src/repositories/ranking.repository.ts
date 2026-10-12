import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  migrate,
  openDatabase,
  resolveDatabasePath,
  runInTransaction,
  VersionedSchema,
} from "./database.js";
import { PlayerFlag } from "../domain/player-flag.js";
import { Player } from "../domain/player.js";
import { PlayerMatch } from "../domain/player-match.js";
import { FantasyPosition } from "../domain/ranking.js";
import { RankingTier } from "../domain/ranking-tier.js";
import { ConflictError, NotFoundError } from "../utils/domain-errors.js";
import {
  labelTierToNumeric,
  MAX_TIERS,
  numericTierToLabel,
} from "../utils/tier.js";

interface RankingPlayerRow {
  id: number;
  rank: number;
  tier_id: number | null;
  tier_position: number | null;
  name: string;
  position: string | null;
  team: string | null;
  source_player_id: string | null;
  sleeper_id: string | null;
  match_method: PlayerMatch["method"];
  match_details: string | null;
}

/** What `match_details` holds: the parts of a match only some rows have. */
type MatchDetails = Pick<PlayerMatch, "candidates" | "warnings">;

/** A player row in rank order. `id` is unset until the row is stored;
 * `replaced` marks a stored row whose content (not just rank or tier)
 * changed, e.g. a resolved unmatched row. */
interface StoredRow {
  id?: number;
  replaced?: boolean;
  match: PlayerMatch;
}

const PLAYER_COLUMNS = `
  ranking_players.id AS id,
  ranking_players.rank AS rank,
  ranking_players.tier_id AS tier_id,
  ranking_tiers.position AS tier_position,
  ranking_players.name AS name,
  ranking_players.position AS position,
  ranking_players.team AS team,
  ranking_players.source_player_id AS source_player_id,
  ranking_players.sleeper_id AS sleeper_id,
  ranking_players.match_method AS match_method,
  ranking_players.match_details AS match_details`;

const PLAYERS_WITH_TIERS = `
  ranking_players
  LEFT JOIN ranking_tiers ON ranking_tiers.id = ranking_players.tier_id`;

function toMatch(row: RankingPlayerRow): PlayerMatch {
  const details = row.match_details
    ? (JSON.parse(row.match_details) as MatchDetails)
    : {};

  return {
    ranking: {
      rank: row.rank,
      playerName: row.name,
      team: row.team ?? undefined,
      position: (row.position ?? undefined) as FantasyPosition | undefined,
      sleeperPlayerId: row.source_player_id ?? undefined,
      tier:
        row.tier_position === null
          ? undefined
          : numericTierToLabel(row.tier_position),
    },
    player: row.sleeper_id === null ? undefined : storedPlayer(row),
    method: row.match_method,
    ...details,
  };
}

/** The row's own data as a player. Rankings don't snapshot Sleeper's
 * player data; services overlay the live player (`withLivePlayer`), and
 * this stands in when the player cache doesn't know the player. */
function storedPlayer(row: RankingPlayerRow): Player {
  return {
    sleeperId: row.sleeper_id!,
    fullName: row.name,
    position: row.position ?? undefined,
    team: row.team ?? undefined,
    active: true,
    fantasyPositions: row.position ? [row.position] : [],
  };
}

function matchDetailsJson(match: PlayerMatch): string | null {
  const details: MatchDetails = {};

  if (match.candidates?.length) {
    details.candidates = match.candidates;
  }

  if (match.warnings?.length) {
    details.warnings = match.warnings;
  }

  return Object.keys(details).length > 0 ? JSON.stringify(details) : null;
}

/** Keeps a user's storage bounded; each ranking holds a few hundred rows. */
export const MAX_RANKINGS_PER_USER = 20;

export interface RankingSummary {
  id: string;
  name: string;
  createdAt: string;
  playerCount: number;
  matchedCount: number;
}

/** Index in `ordered` of the `matchedRank`-th (1-based) matched row, or
 * the end of the list when there are fewer matched rows. */
function indexOfMatchedRank(
  ordered: PlayerMatch[],
  matchedRank: number,
): number {
  let seen = 0;

  for (const [index, match] of ordered.entries()) {
    if (match.player && ++seen === Math.max(1, matchedRank)) {
      return index;
    }
  }

  return ordered.length;
}

/** `preferred` if it sorts between the tiers of the nearest matched rows
 * around `index`, else the tier of the matched row above (or below). */
function fittingTier(
  ordered: PlayerMatch[],
  index: number,
  preferred: string | undefined,
): string | undefined {
  const above = ordered
    .slice(0, index)
    .reverse()
    .find((match) => match.player)?.ranking.tier;
  const below = ordered.slice(index + 1).find((match) => match.player)
    ?.ranking.tier;
  const order = (tier: string | undefined) =>
    tier === undefined ? undefined : labelTierToNumeric(tier);
  const preferredOrder = order(preferred);

  if (
    preferredOrder !== undefined &&
    preferredOrder >= (order(above) ?? 0) &&
    preferredOrder <= (order(below) ?? Infinity)
  ) {
    return preferred;
  }

  return above ?? below ?? preferred;
}

interface TierRow {
  id: number;
  position: number;
}

// Add a schema change as a new step at the end; a step that has shipped
// never changes (see AGENTS.md).
const RANKING_SCHEMA: VersionedSchema = {
  name: "rankings",
  migrations: [
    {
      version: 1,
      up: `
  CREATE TABLE rankings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX rankings_user_id_created_at
    ON rankings (user_id, created_at);

  -- A tier's label (S, A, B, ...) comes from its position, so inserting or
  -- removing a tier only renumbers positions here; players keep their
  -- tier_id.
  CREATE TABLE ranking_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ranking_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    FOREIGN KEY (ranking_id) REFERENCES rankings(id)
      ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX ranking_tiers_ranking_id_position
    ON ranking_tiers (ranking_id, position);

  -- One row per ranked player or unmatched import row. Editor changes
  -- update rows in place, so a row (and its flag) keeps its id.
  CREATE TABLE ranking_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ranking_id TEXT NOT NULL,
    rank INTEGER NOT NULL,
    -- NULL when the import gave no tier; the editor shows such rows in
    -- the first tier.
    tier_id INTEGER,
    -- The row as imported (or as added in the editor).
    name TEXT NOT NULL,
    position TEXT,
    team TEXT,
    -- The CSV's player ID, as given.
    source_player_id TEXT,
    -- The matched Sleeper player; NULL for unmatched and ambiguous rows.
    sleeper_id TEXT,
    match_method TEXT NOT NULL,
    -- JSON: a row's match candidates and warnings, when it has any.
    match_details TEXT,
    flag TEXT CHECK (flag IN ('watch', 'avoid')),
    FOREIGN KEY (ranking_id) REFERENCES rankings(id)
      ON DELETE CASCADE,
    FOREIGN KEY (tier_id) REFERENCES ranking_tiers(id)
  );

  CREATE INDEX ranking_players_ranking_id_rank
    ON ranking_players (ranking_id, rank, id);

  -- A ranking holds each player once (unmatched rows have no sleeper_id).
  CREATE UNIQUE INDEX ranking_players_ranking_id_sleeper_id
    ON ranking_players (ranking_id, sleeper_id);
      `,
    },
  ],
};

export class RankingRepository {
  private readonly database: DatabaseSync;

  constructor(databasePath?: string) {
    const path = resolveDatabasePath(databasePath);
    this.database = openDatabase(path);

    migrate(this.database, RANKING_SCHEMA, path);
  }

  create(
    matches: PlayerMatch[],
    userId: string,
    name = "Imported ranking",
  ): string {
    const rankingId = randomUUID();
    const createdAt = new Date().toISOString();

    runInTransaction(this.database, () => {
      // Users keep several rankings side by side (e.g. one per league);
      // importing or starting a new one adds to them.
      const { count } = this.database
        .prepare(`SELECT COUNT(*) AS count FROM rankings WHERE user_id = ?`)
        .get(userId) as unknown as { count: number };

      if (count >= MAX_RANKINGS_PER_USER) {
        throw new ConflictError(
          `You can keep at most ${MAX_RANKINGS_PER_USER} rankings — delete one first`,
          "RANKING_LIMIT_REACHED",
        );
      }

      this.database
        .prepare(
          `INSERT INTO rankings (id, user_id, name, created_at)
         VALUES (?, ?, ?, ?)`,
        )
        .run(rankingId, userId, name, createdAt);

      const tierIds = this.seedTiersFromMatches(rankingId, matches);

      // Imported ranks are kept as given (gaps and ties included); the
      // first editor change renumbers them 1..N.
      for (const match of matches) {
        this.insertRow(
          rankingId,
          match,
          match.ranking.rank,
          tierIdFor(match, tierIds),
        );
      }
    });

    return rankingId;
  }

  getMatches(rankingId: string, userId: string): PlayerMatch[] {
    const rows = this.database
      .prepare(
        `SELECT ${PLAYER_COLUMNS}
         FROM ${PLAYERS_WITH_TIERS}
         JOIN rankings ON rankings.id = ranking_players.ranking_id
         WHERE ranking_players.ranking_id = ? AND rankings.user_id = ?
         ORDER BY ranking_players.rank ASC, ranking_players.id ASC`,
      )
      .all(rankingId, userId) as unknown as RankingPlayerRow[];

    return rows.map(toMatch);
  }

  hasRanking(rankingId: string, userId: string): boolean {
    const row = this.database
      .prepare(
        `SELECT 1 AS found
         FROM rankings
         WHERE id = ? AND user_id = ?
         LIMIT 1`,
      )
      .get(rankingId, userId) as unknown as { found: number } | undefined;

    return row !== undefined;
  }

  getLatestRankingId(userId: string): string | undefined {
    const row = this.database
      .prepare(
        `SELECT id
         FROM rankings
         WHERE user_id = ?
         ORDER BY created_at DESC, rowid DESC
         LIMIT 1`,
      )
      .get(userId) as unknown as { id: string } | undefined;

    return row?.id;
  }

  hasRankings(userId: string): boolean {
    return this.getLatestRankingId(userId) !== undefined;
  }

  /** The user's rankings, newest first. */
  listRankings(userId: string): RankingSummary[] {
    return this.database
      .prepare(
        `SELECT rankings.id AS id,
                rankings.name AS name,
                rankings.created_at AS createdAt,
                COUNT(ranking_players.id) AS playerCount,
                COUNT(ranking_players.sleeper_id) AS matchedCount
         FROM rankings
         LEFT JOIN ranking_players ON ranking_players.ranking_id = rankings.id
         WHERE rankings.user_id = ?
         GROUP BY rankings.id
         ORDER BY rankings.created_at DESC, rankings.rowid DESC`,
      )
      .all(userId) as unknown as RankingSummary[];
  }

  rename(rankingId: string, userId: string, name: string): void {
    const result = this.database
      .prepare(`UPDATE rankings SET name = ? WHERE id = ? AND user_id = ?`)
      .run(name, rankingId, userId);

    if (result.changes === 0) {
      throw new NotFoundError("Ranking was not found", "RANKING_NOT_FOUND");
    }
  }

  /** Deletes a ranking with its players, tiers, and flags (FK cascade). */
  delete(rankingId: string, userId: string): void {
    const result = this.database
      .prepare(`DELETE FROM rankings WHERE id = ? AND user_id = ?`)
      .run(rankingId, userId);

    if (result.changes === 0) {
      throw new NotFoundError("Ranking was not found", "RANKING_NOT_FOUND");
    }
  }

  /** Deletes all of a user's rankings with their players, tiers, and
   * flags (FK cascade), for account deletion. */
  deleteAllForUser(userId: string): void {
    this.database.prepare(`DELETE FROM rankings WHERE user_id = ?`).run(userId);
  }

  close(): void {
    this.database.close();
  }

  // ---------------------------------------------------------------------
  // Ranking editor mutations
  // ---------------------------------------------------------------------

  /**
   * Moves a player to `targetRank` (1-based) with `targetTier`. If the
   * player is not already part of the ranking, `newMatch` supplies the
   * ranking/player pair to insert instead. The whole list is renumbered
   * 1..N afterwards so rank stays a strict sequence.
   *
   * `targetRank` counts matched players only, as the editor shows them:
   * unmatched rows aren't in the editor's tiers, so they keep their place
   * between their neighbors instead of shifting the target position.
   */
  movePlayer(
    rankingId: string,
    sleeperId: string,
    targetRank: number,
    targetTier: string,
    newMatch?: PlayerMatch,
  ): PlayerMatch[] {
    runInTransaction(this.database, () => {
      const rows = this.getOrderedRows(rankingId);

      const currentIndex = rows.findIndex(
        (row) => row.match.player?.sleeperId === sleeperId,
      );

      let entry: StoredRow;

      if (currentIndex !== -1) {
        [entry] = rows.splice(currentIndex, 1);
      } else {
        if (!newMatch) {
          throw new NotFoundError(
            "Player is not part of this ranking",
            "PLAYER_NOT_RANKED",
          );
        }
        entry = { match: newMatch };
      }

      entry = {
        ...entry,
        match: {
          ...entry.match,
          ranking: { ...entry.match.ranking, tier: targetTier },
        },
      };

      rows.splice(
        indexOfMatchedRank(
          rows.map((row) => row.match),
          targetRank,
        ),
        0,
        entry,
      );

      this.saveOrder(rankingId, rows);
    });

    return this.getOrderedMatches(rankingId);
  }

  /**
   * Replaces the unmatched row at `rank` (1-based, counting every row)
   * with `resolved` at the same position, or removes it when `resolved`
   * is undefined. The row keeps its tier unless edits since the import
   * left it between players of other tiers; it then joins the tier of
   * the matched player above it, so every tier stays one contiguous block.
   */
  replaceUnmatchedRow(
    rankingId: string,
    rank: number,
    resolved: PlayerMatch | undefined,
  ): PlayerMatch[] {
    runInTransaction(this.database, () => {
      const rows = this.getOrderedRows(rankingId);
      const row = rows[rank - 1];

      if (!row || row.match.player) {
        throw new NotFoundError(
          "No unmatched row at this rank",
          "UNMATCHED_ROW_NOT_FOUND",
        );
      }

      if (resolved) {
        rows[rank - 1] = {
          id: row.id,
          replaced: true,
          match: {
            ...resolved,
            ranking: {
              ...resolved.ranking,
              tier: fittingTier(
                rows.map((stored) => stored.match),
                rank - 1,
                row.match.ranking.tier,
              ),
            },
          },
        };
      } else {
        rows.splice(rank - 1, 1);
      }

      this.saveOrder(rankingId, rows);
    });

    return this.getOrderedMatches(rankingId);
  }

  /** Removes a player, with their flag, and closes the rank gap. */
  removePlayer(rankingId: string, sleeperId: string): PlayerMatch[] {
    runInTransaction(this.database, () => {
      this.saveOrder(
        rankingId,
        this.getOrderedRows(rankingId).filter(
          (row) => row.match.player?.sleeperId !== sleeperId,
        ),
      );
    });

    return this.getOrderedMatches(rankingId);
  }

  /** Sets a ranked player's flag, or clears it with `undefined`. */
  setFlag(
    rankingId: string,
    sleeperId: string,
    flag: PlayerFlag | undefined,
  ): void {
    this.database
      .prepare(
        `UPDATE ranking_players SET flag = ?
         WHERE ranking_id = ? AND sleeper_id = ?`,
      )
      .run(flag ?? null, rankingId, sleeperId);
  }

  /** Sleeper ID → flag, for the flagged players of a ranking. */
  getFlags(rankingId: string): Record<string, PlayerFlag> {
    const rows = this.database
      .prepare(
        `SELECT sleeper_id, flag FROM ranking_players
         WHERE ranking_id = ? AND flag IS NOT NULL`,
      )
      .all(rankingId) as unknown as { sleeper_id: string; flag: PlayerFlag }[];

    return Object.fromEntries(rows.map((row) => [row.sleeper_id, row.flag]));
  }

  getTiers(rankingId: string): RankingTier[] {
    const counts = this.database
      .prepare(
        `SELECT tier_id, COUNT(*) AS count
         FROM ranking_players
         WHERE ranking_id = ? AND tier_id IS NOT NULL
         GROUP BY tier_id`,
      )
      .all(rankingId) as unknown as { tier_id: number; count: number }[];

    const countByTierId = new Map(
      counts.map((row) => [row.tier_id, row.count]),
    );

    return this.readTiers(rankingId).map((tier) => ({
      position: tier.position,
      label: numericTierToLabel(tier.position)!,
      playerCount: countByTierId.get(tier.id) ?? 0,
    }));
  }

  /** Inserts a new, empty tier at 1-based `position`, shifting that tier
   * and every one after it one step worse. Players keep their tiers. */
  insertTier(rankingId: string, position: number): RankingTier[] {
    runInTransaction(this.database, () => {
      const tiers = this.readTiers(rankingId);
      const maxPosition = tiers.at(-1)?.position ?? 0;
      const clamped = Math.max(1, Math.min(position, maxPosition + 1));

      if (maxPosition + 1 > MAX_TIERS) {
        throw new ConflictError(
          `Cannot add more than ${MAX_TIERS} tiers`,
          "TIER_LIMIT_REACHED",
        );
      }

      this.shiftTiersFrom(rankingId, clamped, 1);

      this.database
        .prepare(
          `INSERT INTO ranking_tiers (ranking_id, position) VALUES (?, ?)`,
        )
        .run(rankingId, clamped);
    });

    return this.getTiers(rankingId);
  }

  /** Removes the tier at 1-based `position`, merging its players into the
   * next tier down — or, if it's the last (worst) tier, the tier above. */
  removeTier(rankingId: string, position: number): RankingTier[] {
    runInTransaction(this.database, () => {
      const tiers = this.readTiers(rankingId);
      const index = tiers.findIndex((tier) => tier.position === position);

      if (index === -1) {
        throw new NotFoundError(
          `Tier at position ${position} does not exist`,
          "TIER_NOT_FOUND",
        );
      }

      if (tiers.length <= 1) {
        throw new ConflictError(
          "Cannot remove the only remaining tier",
          "LAST_TIER",
        );
      }

      // `tiers` is sorted by position.
      const removed = tiers[index]!;
      const mergeTarget = tiers[index + 1] ?? tiers[index - 1]!;

      this.database
        .prepare(
          `UPDATE ranking_players SET tier_id = ?
           WHERE ranking_id = ? AND tier_id = ?`,
        )
        .run(mergeTarget.id, rankingId, removed.id);

      this.database
        .prepare(`DELETE FROM ranking_tiers WHERE id = ?`)
        .run(removed.id);

      this.shiftTiersFrom(rankingId, position + 1, -1);
    });

    return this.getTiers(rankingId);
  }

  // ---------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------

  private getOrderedRows(rankingId: string): StoredRow[] {
    const rows = this.database
      .prepare(
        `SELECT ${PLAYER_COLUMNS}
         FROM ${PLAYERS_WITH_TIERS}
         WHERE ranking_players.ranking_id = ?
         ORDER BY ranking_players.rank ASC, ranking_players.id ASC`,
      )
      .all(rankingId) as unknown as RankingPlayerRow[];

    return rows.map((row) => ({ id: row.id, match: toMatch(row) }));
  }

  private getOrderedMatches(rankingId: string): PlayerMatch[] {
    return this.getOrderedRows(rankingId).map((row) => row.match);
  }

  /**
   * Stores `rows` as the ranking's players, in this order, ranked 1..N:
   * deletes stored rows that are missing, inserts new ones, and updates a
   * stored row only where its rank, tier or content changed — so rows
   * keep their id (and flag) through edits.
   */
  private saveOrder(rankingId: string, rows: StoredRow[]): void {
    const tierIds = this.tierIdsByLabel(rankingId);

    const stored = new Map(
      (
        this.database
          .prepare(
            `SELECT id, rank, tier_id FROM ranking_players WHERE ranking_id = ?`,
          )
          .all(rankingId) as unknown as {
          id: number;
          rank: number;
          tier_id: number | null;
        }[]
      ).map((row) => [row.id, row]),
    );

    const keptIds = new Set(rows.map((row) => row.id));

    // Deletes first, so a removed player can't collide with the
    // one-row-per-player index.
    for (const id of stored.keys()) {
      if (!keptIds.has(id)) {
        this.database
          .prepare(`DELETE FROM ranking_players WHERE id = ?`)
          .run(id);
      }
    }

    for (const [index, row] of rows.entries()) {
      const rank = index + 1;
      const tierId = tierIdFor(row.match, tierIds);

      if (row.id === undefined) {
        this.insertRow(rankingId, row.match, rank, tierId);
      } else if (row.replaced) {
        this.updateRow(row.id, row.match, rank, tierId);
      } else {
        const current = stored.get(row.id)!;

        if (current.rank !== rank || current.tier_id !== tierId) {
          this.database
            .prepare(
              `UPDATE ranking_players SET rank = ?, tier_id = ? WHERE id = ?`,
            )
            .run(rank, tierId, row.id);
        }
      }
    }
  }

  private insertRow(
    rankingId: string,
    match: PlayerMatch,
    rank: number,
    tierId: number | null,
  ): void {
    this.database
      .prepare(
        `INSERT INTO ranking_players (
           ranking_id, rank, tier_id, name, position, team,
           source_player_id, sleeper_id, match_method, match_details
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(rankingId, rank, tierId, ...rowContent(match));
  }

  /** Rewrites a row's content (a resolved unmatched row); its flag is
   * cleared, since the row now holds a different player. */
  private updateRow(
    id: number,
    match: PlayerMatch,
    rank: number,
    tierId: number | null,
  ): void {
    this.database
      .prepare(
        `UPDATE ranking_players SET
           rank = ?, tier_id = ?, name = ?, position = ?, team = ?,
           source_player_id = ?, sleeper_id = ?, match_method = ?,
           match_details = ?, flag = NULL
         WHERE id = ?`,
      )
      .run(rank, tierId, ...rowContent(match), id);
  }

  /** Creates the tiers the imported rows use (or a single "S" tier) and
   * returns their ids by label. */
  private seedTiersFromMatches(
    rankingId: string,
    matches: PlayerMatch[],
  ): Map<string, number> {
    const positions = new Set<number>();

    for (const match of matches) {
      const numeric = match.ranking.tier
        ? labelTierToNumeric(match.ranking.tier)
        : undefined;

      if (numeric !== undefined) {
        positions.add(numeric);
      }
    }

    if (positions.size === 0) {
      positions.add(1); // every ranking has at least one ("S") tier
    }

    const insertTier = this.database.prepare(
      `INSERT INTO ranking_tiers (ranking_id, position) VALUES (?, ?)`,
    );

    for (const position of positions) {
      insertTier.run(rankingId, position);
    }

    return this.tierIdsByLabel(rankingId);
  }

  /** The ranking's tiers, best first. */
  private readTiers(rankingId: string): TierRow[] {
    return this.database
      .prepare(
        `SELECT id, position FROM ranking_tiers
         WHERE ranking_id = ? ORDER BY position ASC`,
      )
      .all(rankingId) as unknown as TierRow[];
  }

  private tierIdsByLabel(rankingId: string): Map<string, number> {
    return new Map(
      this.readTiers(rankingId).map((tier) => [
        numericTierToLabel(tier.position)!,
        tier.id,
      ]),
    );
  }

  /** Shifts every tier at or past `fromPosition` by `delta`. Players
   * reference tiers by id, so they move along without being touched. */
  private shiftTiersFrom(
    rankingId: string,
    fromPosition: number,
    delta: number,
  ): void {
    const tiers = this.readTiers(rankingId).filter(
      (tier) => tier.position >= fromPosition,
    );

    // Walk in the direction that avoids colliding with the unique
    // (ranking_id, position) index while shifting; `tiers` is ascending.
    const ordered = delta > 0 ? tiers.reverse() : tiers;

    for (const tier of ordered) {
      this.database
        .prepare(`UPDATE ranking_tiers SET position = ? WHERE id = ?`)
        .run(tier.position + delta, tier.id);
    }
  }
}

/** The id of the match's tier, or null for a row without one. */
function tierIdFor(
  match: PlayerMatch,
  tierIds: Map<string, number>,
): number | null {
  return match.ranking.tier === undefined
    ? null
    : (tierIds.get(match.ranking.tier) ?? null);
}

/** A row's content columns, in insertRow/updateRow order. */
function rowContent(match: PlayerMatch) {
  return [
    match.ranking.playerName,
    match.ranking.position ?? null,
    match.ranking.team ?? null,
    match.ranking.sleeperPlayerId ?? null,
    match.player?.sleeperId ?? null,
    match.method,
    matchDetailsJson(match),
  ] as const;
}
