import { describe, expect, it } from "vitest";

import { adpTiers } from "./adp-tiers.js";
import { labelTierToNumeric, MAX_TIERS } from "./tier.js";

/** A draft-like ADP list: about one pick apart, with a little noise. */
function evenlySpacedAdp(count: number): number[] {
  return Array.from(
    { length: count },
    (_, i) => i + 1 + ((i * 7) % 5) / 10,
  ).sort((a, b) => a - b);
}

function tierSizes(tiers: string[]): number[] {
  const sizes = new Map<string, number>();

  for (const tier of tiers) {
    sizes.set(tier, (sizes.get(tier) ?? 0) + 1);
  }

  return [...sizes.values()];
}

describe("adpTiers", () => {
  it("starts a tier at a clear drop-off in ADP", () => {
    const tiers = adpTiers([1, 1.5, 2, 9, 9.5, 10]);

    expect(tiers[2]).not.toBe(tiers[3]);
  });

  it("splits a full ADP list into 20 tiers in order, widening as the draft goes on", () => {
    const tiers = adpTiers(evenlySpacedAdp(300));
    const numeric = tiers.map((tier) => labelTierToNumeric(tier)!);
    const sizes = tierSizes(tiers);

    expect(new Set(tiers).size).toBe(20);
    expect(new Set(tiers).size).toBeLessThanOrEqual(MAX_TIERS);
    expect(tiers[0]).toBe("S");
    // Tiers never go back up: the ADP order is kept.
    expect(numeric).toEqual([...numeric].sort((a, b) => a - b));
    expect(sizes[0]!).toBeLessThan(sizes.at(-1)!);
  });

  it("is deterministic", () => {
    const adp = evenlySpacedAdp(250);

    expect(adpTiers(adp)).toEqual(adpTiers([...adp]));
  });

  it("keeps players with the same ADP in one tier", () => {
    const tiers = adpTiers([1, 2, 3, 3, 3, 4, 5]);

    expect(new Set(tiers.slice(2, 5)).size).toBe(1);
  });

  it("gives fewer tiers than players with distinct ADP values", () => {
    expect(adpTiers([1, 2, 2])).toEqual(["S", "A", "A"]);
    expect(adpTiers([5, 5])).toEqual(["S", "S"]);
    expect(adpTiers([])).toEqual([]);
  });
});
