import { ProcessedRankingImport } from "./ranking-import.service.js";

export function mapRankingImportResponse(
  rankingId: string,
  result: ProcessedRankingImport,
) {
  return {
    rankingId,
    summary: result.summary,
    validationErrors: result.importResult.errors,
    unmatchedPlayers: result.matches
      .filter((match) => match.method === "NONE")
      .map((match) => ({
        rank: match.ranking.rank,
        name: match.ranking.playerName,
        team: match.ranking.team,
        position: match.ranking.position,
        // Matched a player an earlier row already holds.
        duplicate: match.warnings?.includes("DUPLICATE_PLAYER") || undefined,
      })),
    ambiguousPlayers: result.matches
      .filter((match) => match.method === "AMBIGUOUS")
      .map((match) => ({
        rank: match.ranking.rank,
        name: match.ranking.playerName,
        candidates: match.candidates?.map((player) => ({
          sleeperId: player.sleeperId,
          fullName: player.fullName,
        })),
      })),
  };
}
