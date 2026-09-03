import {
  DraftState,
} from "../domain/draft-state.js";

import {
  Player,
} from "../domain/player.js";

import {
  DraftService,
} from "./draft.service.js";

import {
  PlayerService,
} from "./player.service.js";

import {
  isFantasyRelevantPlayer,
} from "../utils/is-fantasy-relevant-player.js";

export class DraftStateService {
  constructor(
    private readonly draftService: DraftService,

    private readonly playerService: PlayerService,
  ) { }

  async getDraftState(
    draftId: string,
  ): Promise<DraftState> {
    await this.playerService
      .ensurePlayersLoaded();

    const [
      draft,
      draftedPlayerIds,
    ] = await Promise.all([
      this.draftService.getDraft(
        draftId,
      ),

      this.draftService.getDraftedPlayerIds(
        draftId,
      ),
    ]);

    const allPlayers =
      this.playerService.getAllPlayers();

    const availablePlayers =
      this.getAvailablePlayers(
        allPlayers,
        draftedPlayerIds,
      );

    return {
      draft,

      draftedPlayerIds,

      availablePlayers,

      lastUpdatedAt: new Date(),
    };
  }

  private getAvailablePlayers(
    players: Player[],

    draftedPlayerIds: Set<string>,
  ): Player[] {
    return players.filter(
      (player) =>
        isFantasyRelevantPlayer(
          player
        ) &&
        !draftedPlayerIds.has(
          player.sleeperId,
        ),
    );
  }
}