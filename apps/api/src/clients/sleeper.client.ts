import {
  SleeperDraft,
  SleeperDraftPick,
  SleeperPlayersResponse,
} from "../types/sleeper.js";

import { HttpError } from "../utils/http-error.js";

const SLEEPER_API_BASE_URL =
  "https://api.sleeper.app/v1";

export class SleeperClient {
  async getDraft(
    draftId: string,
  ): Promise<SleeperDraft> {
    return this.get<SleeperDraft>(
      `/draft/${draftId}`,
    );
  }

  async getDraftPicks(
    draftId: string,
  ): Promise<SleeperDraftPick[]> {
    return this.get<SleeperDraftPick[]>(
      `/draft/${draftId}/picks`,
    );
  }

  async getNFLPlayers(): Promise<
    SleeperPlayersResponse
  > {
    return this.get<SleeperPlayersResponse>(
      "/players/nfl",
    );
  }

  private async get<T>(
    path: string,
  ): Promise<T> {
    const response = await fetch(
      `${SLEEPER_API_BASE_URL}${path}`,
    );

    if (!response.ok) {
      throw new HttpError(
        response.status,
        `Sleeper API request failed: ` +
          `${response.status} ` +
          `${response.statusText}`,
      );
    }

    return response.json() as Promise<T>;
  }
}