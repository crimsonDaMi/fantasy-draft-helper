import type {
  RankingImportResponse,
  RecommendationsResponse,
} from "../types/api";

const API_BASE_URL =
  import.meta.env
    .VITE_API_BASE_URL ??
  "http://localhost:3000";

export class ApiRequestError extends Error {
  readonly status?: number;

  constructor(
    message: string,

    status?: number,
  ) {
    super(message);

    this.status = status;
  }
}

async function getErrorMessage(
  response: Response,
): Promise<string> {
  try {
    const error = await response.json();

    return error.message ??
      error.error ??
      "Request failed";
  } catch {
    return "Request failed";
  }
}

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
      `${API_BASE_URL}/rankings`,
      {
        method: "POST",

        body: formData,
      },
    );

  if (!response.ok) {
    throw new ApiRequestError(
      await getErrorMessage(response),
      response.status,
    );
  }

  return response.json();
}

export interface GetRecommendationsOptions {
  limit?: number;
  positions?: string[];
}

export async function getRecommendations(
  draftId: string,
  rankingId: string,
  options: GetRecommendationsOptions = {},
): Promise<RecommendationsResponse> {
  const { limit = 20, positions } = options;

  const params = new URLSearchParams({
    rankingId,
    limit: String(limit),
  });

  if (positions && positions.length > 0) {
    params.set("positions", positions.join(","));
  }

  const response = await fetch(
    `${API_BASE_URL}/drafts/${draftId}/recommendations?${params.toString()}`,
  );

  if (!response.ok) {
    throw new ApiRequestError(
      await getErrorMessage(response),
      response.status,
    );
  }

  return response.json();
}