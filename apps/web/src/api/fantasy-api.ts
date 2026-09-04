import type {
  RankingImportResponse,
  RecommendationsResponse,
} from "../types/api";

const API_BASE_URL =
  import.meta.env
    .VITE_API_BASE_URL ??
  "http://localhost:3000";

export async function importRankings(
  file: File,
): Promise<RankingImportResponse> {
  const formData =
    new FormData();

  formData.append(
    "file",
    file,
  );

  const response =
    await fetch(
      `${API_BASE_URL}/rankings/import`,
      {
        method: "POST",

        body: formData,
      },
    );

  if (!response.ok) {
    const error =
      await response.json();

    throw new Error(
      error.error ??
      "Failed to import rankings",
    );
  }

  return response.json();
}

export async function getRecommendations(
  draftId: string,

  limit = 10,
): Promise<RecommendationsResponse> {
  const response =
    await fetch(
      `${API_BASE_URL}/drafts/${draftId}/recommendations?limit=${limit}`,
    );

  if (!response.ok) {
    const error =
      await response.json();

    throw new Error(
      error.error ??
      "Failed to load recommendations",
    );
  }

  return response.json();
}