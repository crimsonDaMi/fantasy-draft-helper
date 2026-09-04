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

export async function getRecommendations(
  draftId: string,

  rankingId: string,

  limit = 10,
): Promise<RecommendationsResponse> {
  const response =
    await fetch(
      `${API_BASE_URL}/drafts/${draftId}/recommendations?rankingId=${encodeURIComponent(
        rankingId,
      )}&limit=${limit}`,
    );

  if (!response.ok) {
    throw new ApiRequestError(
      await getErrorMessage(response),
      response.status,
    );
  }

  return response.json();
}