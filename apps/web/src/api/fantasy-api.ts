import type {
  ApiPlayer,
  RankingDetailResponse,
  RankingImportResponse,
  RankingPlayerDto,
  RankingStatusResponse,
  RankingTierDto,
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

type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function notifyUnauthorized(): void {
  for (const listener of unauthorizedListeners) {
    listener();
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
    if (response.status === 401) {
      notifyUnauthorized();
    }
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
    if (response.status === 401) {
      notifyUnauthorized();
    }
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

export async function getRankingsStatus(): Promise<RankingStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/rankings/status`, {
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      notifyUnauthorized();
    }
    throw new ApiRequestError(await getErrorMessage(response), response.status);
  }

  return response.json();
}

export async function getRanking(
  rankingId: string,
): Promise<RankingDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/rankings/${rankingId}`, {
    credentials: "include",
  });

  if (!response.ok) {
    if (response.status === 401) {
      notifyUnauthorized();
    }
    throw new ApiRequestError(await getErrorMessage(response), response.status);
  }

  return response.json();
}

export async function getUnrankedPlayers(
  rankingId: string,
): Promise<{ players: ApiPlayer[] }> {
  const response = await fetch(
    `${API_BASE_URL}/rankings/${rankingId}/unranked-players`,
    { credentials: "include" },
  );

  if (!response.ok) {
    if (response.status === 401) {
      notifyUnauthorized();
    }
    throw new ApiRequestError(await getErrorMessage(response), response.status);
  }

  return response.json();
}

export async function moveRankingPlayer(
  rankingId: string,
  sleeperId: string,
  rank: number,
  tier: string,
): Promise<{ players: RankingPlayerDto[] }> {
  const response = await fetch(
    `${API_BASE_URL}/rankings/${rankingId}/players/${sleeperId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rank, tier }),
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      notifyUnauthorized();
    }
    throw new ApiRequestError(await getErrorMessage(response), response.status);
  }

  return response.json();
}

export async function removeRankingPlayer(
  rankingId: string,
  sleeperId: string,
): Promise<{ players: RankingPlayerDto[] }> {
  const response = await fetch(
    `${API_BASE_URL}/rankings/${rankingId}/players/${sleeperId}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      notifyUnauthorized();
    }
    throw new ApiRequestError(await getErrorMessage(response), response.status);
  }

  return response.json();
}

export async function insertTier(
  rankingId: string,
  position: number,
): Promise<{ tiers: RankingTierDto[] }> {
  const response = await fetch(`${API_BASE_URL}/rankings/${rankingId}/tiers`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ position }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      notifyUnauthorized();
    }
    throw new ApiRequestError(await getErrorMessage(response), response.status);
  }

  return response.json();
}

export async function removeTier(
  rankingId: string,
  position: number,
): Promise<{ tiers: RankingTierDto[] }> {
  const response = await fetch(
    `${API_BASE_URL}/rankings/${rankingId}/tiers/${position}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!response.ok) {
    if (response.status === 401) {
      notifyUnauthorized();
    }
    throw new ApiRequestError(await getErrorMessage(response), response.status);
  }

  return response.json();
}
