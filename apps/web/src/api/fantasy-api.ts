import type {
  ApiPlayer,
  PlayerFlag,
  RankingDetailResponse,
  RankingImportResponse,
  RankingPlayerDto,
  RankingSummary,
  RankingTierDto,
  RecommendationsResponse,
  UserDraftsResponse,
} from "../types/api";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export class ApiRequestError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
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

interface RequestOptions {
  /** Whether a 401 means "the session expired" and should notify
   * `onUnauthorized` listeners. Off for the auth endpoints themselves,
   * where a 401 just means wrong credentials / not logged in yet. */
  notifyOnUnauthorized?: boolean;
}

/** Sends a same-site, cookie-authenticated request and parses the JSON
 * body, throwing `ApiRequestError` for any non-2xx response. */
async function request<T>(
  path: string,
  init: RequestInit = {},
  { notifyOnUnauthorized = true }: RequestOptions = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
  });

  if (!response.ok) {
    if (notifyOnUnauthorized && response.status === 401) {
      notifyUnauthorized();
    }
    throw new ApiRequestError(await getErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function jsonBody(body: unknown): RequestInit {
  return {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** Builds a path from template segments, URL-encoding every
 * interpolated value (ids come from user input or the URL). */
function path(
  strings: TemplateStringsArray,
  ...values: (string | number)[]
): string {
  return strings.reduce(
    (result, segment, index) =>
      result +
      segment +
      (index < values.length ? encodeURIComponent(values[index]) : ""),
    "",
  );
}

export function importRankings(
  file: File,
  name?: string,
): Promise<RankingImportResponse> {
  const formData = new FormData();

  // Before the file: the API reads fields sent ahead of it.
  if (name && name.trim() !== "") {
    formData.append("name", name.trim());
  }
  formData.append("file", file);

  return request("/rankings", { method: "POST", body: formData });
}

export function createEmptyRanking(): Promise<{ rankingId: string }> {
  return request("/rankings/new", { method: "POST" });
}

export function listRankings(): Promise<{ rankings: RankingSummary[] }> {
  return request("/rankings");
}

export function renameRanking(
  rankingId: string,
  name: string,
): Promise<{ rankingId: string; name: string }> {
  return request(path`/rankings/${rankingId}`, {
    method: "PATCH",
    ...jsonBody({ name }),
  });
}

export function deleteRanking(rankingId: string): Promise<void> {
  return request(path`/rankings/${rankingId}`, { method: "DELETE" });
}

export function setPlayerFlag(
  rankingId: string,
  sleeperId: string,
  flag: PlayerFlag | null,
): Promise<{ flags: Record<string, PlayerFlag> }> {
  return request(path`/rankings/${rankingId}/players/${sleeperId}/flag`, {
    method: "PATCH",
    ...jsonBody({ flag }),
  });
}

export interface GetRecommendationsOptions {
  limit?: number;
  positions?: string[];
  query?: string;
  showAvoided?: boolean;
}

export function getRecommendations(
  draftId: string,
  rankingId: string,
  options: GetRecommendationsOptions = {},
): Promise<RecommendationsResponse> {
  const { limit = 20, positions, query, showAvoided } = options;

  const params = new URLSearchParams({
    rankingId,
    limit: String(limit),
  });

  if (positions && positions.length > 0) {
    params.set("positions", positions.join(","));
  }

  if (query && query.trim() !== "") {
    params.set("q", query.trim());
  }

  if (showAvoided) {
    params.set("showAvoided", "true");
  }

  const recommendationsPath = path`/drafts/${draftId}/recommendations`;

  return request(`${recommendationsPath}?${params.toString()}`);
}

export function findUserDrafts(
  username: string,
  season: string,
): Promise<UserDraftsResponse> {
  const params = new URLSearchParams({ username, season });

  return request(`/drafts?${params.toString()}`);
}

export interface AuthUser {
  id: string;
  username: string;
}

async function postCredentials(
  credentialsPath: string,
  username: string,
  password: string,
): Promise<AuthUser> {
  const body = await request<{ user: AuthUser }>(
    credentialsPath,
    { method: "POST", ...jsonBody({ username, password }) },
    { notifyOnUnauthorized: false },
  );

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

/** Best effort: the response status is ignored, since the user is logged
 * out locally either way and an expired session is already gone. */
export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
}

export async function getCurrentUser(): Promise<AuthUser | undefined> {
  try {
    const body = await request<{ user: AuthUser }>(
      "/auth/me",
      {},
      { notifyOnUnauthorized: false },
    );

    return body.user;
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      return undefined;
    }
    throw error;
  }
}

/** Plain link target (not fetched): the browser downloads the CSV itself. */
export function rankingExportUrl(rankingId: string): string {
  return `${API_BASE_URL}${path`/rankings/export?rankingId=${rankingId}`}`;
}

export function getRanking(rankingId: string): Promise<RankingDetailResponse> {
  return request(path`/rankings/${rankingId}`);
}

export function getUnrankedPlayers(
  rankingId: string,
): Promise<{ players: ApiPlayer[] }> {
  return request(path`/rankings/${rankingId}/unranked-players`);
}

export function moveRankingPlayer(
  rankingId: string,
  sleeperId: string,
  rank: number,
  tier: string,
): Promise<{ players: RankingPlayerDto[] }> {
  return request(path`/rankings/${rankingId}/players/${sleeperId}`, {
    method: "PATCH",
    ...jsonBody({ rank, tier }),
  });
}

export function removeRankingPlayer(
  rankingId: string,
  sleeperId: string,
): Promise<{ players: RankingPlayerDto[] }> {
  return request(path`/rankings/${rankingId}/players/${sleeperId}`, {
    method: "DELETE",
  });
}

/** Resolves an unmatched import row (at `rank`, counting every row) to
 * the chosen player. `playerName` is the row's name, so the server can
 * refuse if the row has moved since. */
export function resolveUnmatchedRow(
  rankingId: string,
  rank: number,
  playerName: string,
  sleeperId: string,
): Promise<{ players: RankingPlayerDto[] }> {
  return request(path`/rankings/${rankingId}/unmatched/${rank}`, {
    method: "PATCH",
    ...jsonBody({ playerName, sleeperId }),
  });
}

export function removeUnmatchedRow(
  rankingId: string,
  rank: number,
  playerName: string,
): Promise<{ players: RankingPlayerDto[] }> {
  return request(
    path`/rankings/${rankingId}/unmatched/${rank}?playerName=${playerName}`,
    { method: "DELETE" },
  );
}

export function insertTier(
  rankingId: string,
  position: number,
): Promise<{ tiers: RankingTierDto[] }> {
  return request(path`/rankings/${rankingId}/tiers`, {
    method: "POST",
    ...jsonBody({ position }),
  });
}

export function removeTier(
  rankingId: string,
  position: number,
): Promise<{ tiers: RankingTierDto[] }> {
  return request(path`/rankings/${rankingId}/tiers/${position}`, {
    method: "DELETE",
  });
}
