import {
  describe,
  expect,
  it,
} from "vitest";

import {
  mapDraftStatus,
  mapSleeperDraftPick,
} from "./draft.mapper.js";

describe(
  "mapDraftStatus",

  () => {
    it(
      "maps pre_draft",

      () => {
        expect(
          mapDraftStatus(
            "pre_draft",
          ),
        ).toBe("PRE_DRAFT");
      },
    );

    it(
      "maps drafting",

      () => {
        expect(
          mapDraftStatus(
            "drafting",
          ),
        ).toBe("DRAFTING");
      },
    );

    it(
      "maps complete",

      () => {
        expect(
          mapDraftStatus(
            "complete",
          ),
        ).toBe("COMPLETE");
      },
    );

    it(
      "maps unknown statuses",

      () => {
        expect(
          mapDraftStatus(
            "something_else",
          ),
        ).toBe("UNKNOWN");
      },
    );
  },
);

describe(
  "mapSleeperDraftPick",

  () => {
    it(
      "maps a player pick",

      () => {
        const result =
          mapSleeperDraftPick({
            player_id: "123",

            pick_no: 1,

            round: 1,

            draft_slot: 1,

            metadata: {
              position: "QB",

              team: "BUF",
            },
          });

        expect(result).toEqual({
          playerId: "123",

          pickNo: 1,

          round: 1,

          draftSlot: 1,

          rosterId: undefined,

          pickedBy: undefined,

          position: "QB",

          team: "BUF",
        });
      },
    );

    it(
      "returns null without player ID",

      () => {
        const result =
          mapSleeperDraftPick({
            pick_no: 1,
          });

        expect(result).toBeNull();
      },
    );
  },
);