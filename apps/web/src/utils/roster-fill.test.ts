import { describe, expect, it } from "vitest";

import { fillRoster } from "./roster-fill";

describe("fillRoster", () => {
  it("fills exact slots, then flex slots, then the bench", () => {
    const fills = fillRoster(["QB", "QB", "RB", "RB", "RB", "WR", "QB"], {
      QB: 1,
      RB: 2,
      WR: 2,
      FLEX: 1,
      SUPER_FLEX: 1,
      BN: 5,
    });

    expect(fills).toEqual([
      { slot: "QB", filled: 1, required: 1 },
      { slot: "RB", filled: 2, required: 2 },
      { slot: "WR", filled: 1, required: 2 },
      { slot: "FLEX", filled: 1, required: 1 },
      { slot: "SUPER_FLEX", filled: 1, required: 1 },
      { slot: "BN", filled: 1, required: 5 },
    ]);
  });

  it("fills the narrowest flex slot first", () => {
    const fills = fillRoster(["TE", "RB"], {
      WRRB_FLEX: 1,
      FLEX: 1,
    });

    expect(fills).toEqual([
      { slot: "WRRB_FLEX", filled: 1, required: 1 },
      { slot: "FLEX", filled: 1, required: 1 },
    ]);
  });
});
