import { describe, expect, it } from "vitest";

import { DraftStateService } from "./draft-state.service.js";

describe("DraftStateService", () => {
  it("collects the drafted player IDs", async () => {
    const draftService = {
      getDraft: async () => ({
        id: "draft-1",
        status: "DRAFTING",
        sport: "nfl",
        season: "2026",
      }),
      getDraftPicks: async () => [
        {
          playerId: "2",
          pickNo: 1,
        },
      ],
    };

    const playerService = {
      ensurePlayersLoaded: async () => {},
    };

    const service = new DraftStateService(
      draftService as never,
      playerService as never,
    );

    const result = await service.getDraftState("draft-1");

    expect([...result.draftedPlayerIds]).toEqual(["2"]);
  });
});
