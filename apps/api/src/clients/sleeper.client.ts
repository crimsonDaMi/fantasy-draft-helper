import {
  SleeperDraft,
  SleeperDraftPick,
  SleeperPlayersResponse,
  SleeperTradedPick,
  SleeperUser,
} from "../types/sleeper.js";
import { HttpError } from "../utils/http-error.js";

const SLEEPER_API_BASE_URL = "https://api.sleeper.app/v1";

export class SleeperClient {
  async getDraft(draftId: string): Promise<SleeperDraft> {
    return this.get<SleeperDraft>(`/draft/${draftId}`);
  }

  async getDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
    return this.get<SleeperDraftPick[]>(`/draft/${draftId}/picks`);
  }

  /** Resolves to `null` for an unknown draft (Sleeper answers 200). */
  async getDraftTradedPicks(
    draftId: string,
  ): Promise<SleeperTradedPick[] | null> {
    return this.get<SleeperTradedPick[] | null>(
      `/draft/${draftId}/traded_picks`,
    );
  }

  /** Resolves to `null` for an unknown username (Sleeper answers 200). */
  async getUser(username: string): Promise<SleeperUser | null> {
    return this.get<SleeperUser | null>(
      `/user/${encodeURIComponent(username)}`,
    );
  }

  async getUserDrafts(userId: string, season: string): Promise<SleeperDraft[]> {
    return this.get<SleeperDraft[]>(
      `/user/${encodeURIComponent(userId)}/drafts/nfl/${encodeURIComponent(season)}`,
    );
  }

  async getNFLPlayers(): Promise<SleeperPlayersResponse> {
    return this.get<SleeperPlayersResponse>("/players/nfl");
  }

  /**
   * Upstream failures become 502, which the web app retries; only a 404
   * (e.g. an unknown draft ID) is passed through, as a permanent answer.
   */
  private async get<T>(path: string): Promise<T> {
    let response: Response;

    try {
      response = await fetch(`${SLEEPER_API_BASE_URL}${path}`);
    } catch (error) {
      throw new HttpError(
        502,
        "Sleeper could not be reached. Try again in a moment.",
        "SLEEPER_UNAVAILABLE",
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new HttpError(
        response.status === 404 ? 404 : 502,
        `Sleeper API request failed: ${response.status} ${response.statusText}`,
        "SLEEPER_API_ERROR",
      );
    }

    return response.json() as Promise<T>;
  }
}
