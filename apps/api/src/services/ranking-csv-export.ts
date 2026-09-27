import { PlayerMatch } from "../domain/player-match.js";

const HEADERS = ["rank", "player", "position", "team", "tier", "player_id"];

/**
 * Serializes a ranking to the canonical import CSV, so a user can back it
 * up before a schema-changing release wipes the database and re-import it
 * afterwards. Matched rows carry `player_id`, which the importer resolves
 * directly (no name matching), so edits made in the ranking editor
 * round-trip exactly. Unmatched/ambiguous rows have no `player_id` and go
 * through name matching again on re-import.
 */
export function toRankingCsv(matches: PlayerMatch[]): string {
  const rows = matches.map(({ ranking, player }) => [
    String(ranking.rank),
    ranking.playerName,
    ranking.position ?? "",
    ranking.team ?? "",
    ranking.tier ?? "",
    player?.sleeperId ?? "",
  ]);

  return [HEADERS, ...rows]
    .map((row) => row.map(escapeCsvField).join(","))
    .join("\n")
    .concat("\n");
}

function escapeCsvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
