import { describe, expect, it } from "vitest";

import { Ranking } from "../domain/ranking.js";

import { normalizeRankingTiers } from "./normalize-ranking-tiers.js";

function ranking(rank: number, tier?: string): Ranking {
  return { rank, playerName: `Player ${rank}`, tier };
}

describe("normalizeRankingTiers", () => {
  it("passes through already-valid tier labels unchanged", () => {
    const result = normalizeRankingTiers([ranking(1, "S"), ranking(2, "A")]);

    expect(result.map((r) => r.tier)).toEqual(["S", "A"]);
  });

  it("converts numeric tiers to labels", () => {
    const result = normalizeRankingTiers([ranking(1, "1"), ranking(2, "2")]);

    expect(result.map((r) => r.tier)).toEqual(["S", "A"]);
  });

  it("assigns everyone to A when no row has a recognized tier", () => {
    const result = normalizeRankingTiers([
      ranking(1),
      ranking(2, "garbage"),
      ranking(3),
    ]);

    expect(result.map((r) => r.tier)).toEqual(["A", "A", "A"]);
  });

  it("borrows the tier of the nearest worse-ranked tiered player, forward", () => {
    const result = normalizeRankingTiers([
      ranking(1),
      ranking(2),
      ranking(3, "B"),
      ranking(4),
    ]);

    // ranks 1 and 2 forward-borrow "B" from rank 3. Rank 4 has nothing
    // tiered after it, so it's a trailing row: gets the tier one step
    // worse than the last originally-tiered row (rank 3's "B" -> "C").
    expect(result.map((r) => r.tier)).toEqual(["B", "B", "B", "C"]);
  });

  it("assigns trailing untiered rows the tier one step worse than the last tiered row", () => {
    const result = normalizeRankingTiers([
      ranking(1, "S"),
      ranking(2),
      ranking(3),
    ]);

    expect(result.map((r) => r.tier)).toEqual(["S", "A", "A"]);
  });

  it("keeps trailing rows at Z when the last tiered row is already Z", () => {
    const result = normalizeRankingTiers([
      ranking(1, "Z"),
      ranking(2),
      ranking(3),
    ]);

    expect(result.map((r) => r.tier)).toEqual(["Z", "Z", "Z"]);
  });

  it("treats an unrecognized tier value the same as a missing one", () => {
    const result = normalizeRankingTiers([
      ranking(1, "not-a-tier"),
      ranking(2, "A"),
    ]);

    expect(result.map((r) => r.tier)).toEqual(["A", "A"]);
  });

  it("never lets a borrowed or trailing-assigned tier become an anchor for another row", () => {
    const result = normalizeRankingTiers([
      ranking(1, "S"),
      ranking(2), // forward-borrows "B" from rank 3, not "S" from rank 1
      ranking(3, "B"),
      ranking(4), // trailing: last tiered row is rank 3's "B" -> "C"
    ]);

    expect(result.map((r) => r.tier)).toEqual(["S", "B", "B", "C"]);
  });

  it("sorts by rank before resolving, regardless of input order", () => {
    const result = normalizeRankingTiers([
      ranking(3, "B"),
      ranking(1),
      ranking(2),
    ]);

    expect(result.map((r) => [r.rank, r.tier])).toEqual([
      [1, "B"],
      [2, "B"],
      [3, "B"],
    ]);
  });
});
