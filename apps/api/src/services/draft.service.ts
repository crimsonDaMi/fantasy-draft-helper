import { SleeperClient } from "../clients/sleeper.client.js";

import {
  Draft,
  DraftPick,
} from "../domain/draft.js";

import {
  mapSleeperDraft,
  mapSleeperDraftPick,
} from "./draft.mapper.js";

export class DraftService {
  constructor(
    private readonly sleeperClient: SleeperClient,
  ) {}

  async getDraft(
    draftId: string,
  ): Promise<Draft> {
    const sleeperDraft =
      await this.sleeperClient.getDraft(
        draftId,
      );

    return mapSleeperDraft(
      sleeperDraft,
    );
  }

  async getDraftPicks(
    draftId: string,
  ): Promise<DraftPick[]> {
    const sleeperPicks =
      await this.sleeperClient.getDraftPicks(
        draftId,
      );

    return sleeperPicks
      .map(mapSleeperDraftPick)
      .filter(
        (pick): pick is DraftPick =>
          pick !== null,
      );
  }

  async getDraftedPlayerIds(
    draftId: string,
  ): Promise<Set<string>> {
    const picks =
      await this.getDraftPicks(draftId);

    return new Set(
      picks.map((pick) => pick.playerId),
    );
  }
}