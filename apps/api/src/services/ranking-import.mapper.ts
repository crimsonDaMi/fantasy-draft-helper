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
