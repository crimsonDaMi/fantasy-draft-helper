import { DraftState } from "../domain/draft-state.js";
import { DraftService } from "./draft.service.js";
import { PlayerService } from "./player.service.js";

export class DraftStateService {
  constructor(
    private readonly draftService: DraftService,
    private readonly playerService: Pick<PlayerService, "ensurePlayersLoaded">,
  ) {}

  async getDraftState(draftId: string): Promise<DraftState> {
    await this.playerService.ensurePlayersLoaded();

    const [draft, picks] = await Promise.all([
      this.draftService.getDraft(draftId),
      this.draftService.getDraftPicks(draftId),
    ]);

    return {
      draft,
      picks,
      draftedPlayerIds: new Set(picks.map((pick) => pick.playerId)),
      lastUpdatedAt: new Date(),
    };
  }
}
