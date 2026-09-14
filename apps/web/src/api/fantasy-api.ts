import type {
  RankingImportResponse,
  RecommendationsResponse,
} from "../types/api";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

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

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const error = await response.json();

    return error.message ?? error.error ?? "Request failed";
  } catch {
    return "Request failed";
  }
}

export async function importRankings(
  file: File,
): Promise<RankingImportResponse> {
  const formData = new FormData();

  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/rankings`, {
    method: "POST",

    body: formData,

    credentials: "include",
  });

  if (!response.ok) {
    throw new ApiRequestError(await getErrorMessage(response), response.status);
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
    { credentials: "include" },
  );

  if (!response.ok) {
    throw new ApiRequestError(await getErrorMessage(response), response.status);
  }

  return response.json();
}

export interface AuthUser {
  id: string;
  username: string;
}

async function postCredentials(
  path: string,
  username: string,
  password: string,
): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    throw new ApiRequestError(await getErrorMessage(response), response.status);
  }

  const body = (await response.json()) as { user: AuthUser };
  return body.user;
}

export function register(
  username: string,
  password: string,
): Promise<AuthUser> {
  return postCredentials("/auth/register", username, password);
}

export function login(username: string, password: string): Promise<AuthUser> {
  return postCredentials("/auth/login", username, password);
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function getCurrentUser(): Promise<AuthUser | undefined> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    credentials: "include",
  });

  if (response.status === 401) {
    return undefined;
  }

  if (!response.ok) {
    throw new ApiRequestError(await getErrorMessage(response), response.status);
  }

  const body = (await response.json()) as { user: AuthUser };
  return body.user;
}
