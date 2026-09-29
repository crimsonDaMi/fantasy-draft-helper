import { SleeperClient } from "../clients/sleeper.client.js";
import { Draft, DraftPick } from "../domain/draft.js";
import { NotFoundError } from "../utils/domain-errors.js";
import { mapSleeperDraft, mapSleeperDraftPick } from "./draft.mapper.js";

export interface UserDrafts {
  sleeperUserId: string;
  drafts: Draft[];
}

export class DraftService {
  constructor(private readonly sleeperClient: SleeperClient) {}

  async getDraft(draftId: string): Promise<Draft> {
    const [sleeperDraft, tradedPicks] = await Promise.all([
      this.sleeperClient.getDraft(draftId),
      this.sleeperClient.getDraftTradedPicks(draftId),
    ]);

    return mapSleeperDraft(sleeperDraft, tradedPicks);
  }

  /** A Sleeper user's NFL drafts for a season, newest first. */
  async findUserDrafts(username: string, season: string): Promise<UserDrafts> {
    const user = await this.sleeperClient.getUser(username);

    if (!user) {
      throw new NotFoundError(
        `Sleeper user "${username}" was not found`,
        "SLEEPER_USER_NOT_FOUND",
      );
    }

    const drafts = await this.sleeperClient.getUserDrafts(user.user_id, season);

    return {
      sleeperUserId: user.user_id,
      drafts: drafts
        .map((draft) => mapSleeperDraft(draft))
        .sort((a, b) => (b.startTime ?? 0) - (a.startTime ?? 0)),
    };
  }

  async getDraftPicks(draftId: string): Promise<DraftPick[]> {
    const sleeperPicks = await this.sleeperClient.getDraftPicks(draftId);

    return sleeperPicks
      .map(mapSleeperDraftPick)
      .filter((pick): pick is DraftPick => pick !== null);
  }
}
