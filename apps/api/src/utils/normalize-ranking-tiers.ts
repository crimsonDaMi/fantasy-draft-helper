import { Ranking } from "../domain/ranking.js";

import { nextTierLabel, normalizeTierValue } from "./tier.js";

/**
 * Assigns every ranking a recognized internal tier label. Rows with a
 * missing or unrecognized tier value borrow from the nearest worse-ranked
 * (forward) row with a recognized tier. Trailing rows — with no tiered
 * row after them — are assigned the tier one step worse than the last
 * originally-tiered row, as a group (not incrementing per row); if that
 * tier is already the worst ("Z"), the trailing group stays "Z" too. If
 * no row has a recognized tier at all, every row is assigned "A".
 */
export function normalizeRankingTiers(rankings: Ranking[]): Ranking[] {
  const sorted = [...rankings].sort((a, b) => a.rank - b.rank);

  const recognized = sorted.map((ranking) => normalizeTierValue(ranking.tier));

  if (recognized.every((tier) => tier === undefined)) {
    return sorted.map((ranking) => ({ ...ranking, tier: "A" }));
  }

  const resolved = [...recognized];

  // Forward pass: an untiered row borrows the nearest worse-ranked
  // (later) row's recognized tier. Only ever reads from `recognized`,
  // never from `resolved` — a borrowed tier can't itself become an
  // anchor for another row.
  for (let i = 0; i < resolved.length; i++) {
    if (resolved[i] !== undefined) continue;

    let j = i + 1;
    while (j < resolved.length && recognized[j] === undefined) j++;

    if (j < resolved.length) {
      resolved[i] = recognized[j];
    }
  }

  // Anything still unresolved is necessarily a trailing row — nothing
  // tiered follows it, or forward-pass would have caught it. Assign the
  // whole trailing block the tier one step worse than the last
  // originally-tiered row.
  const lastTieredIndex = recognized.reduce(
    (last, tier, index) => (tier !== undefined ? index : last),
    -1,
  );

  if (lastTieredIndex !== -1) {
    const trailingTier = nextTierLabel(recognized[lastTieredIndex]!);

    for (let i = lastTieredIndex + 1; i < resolved.length; i++) {
      if (resolved[i] === undefined) {
        resolved[i] = trailingTier;
      }
    }
  }

  return sorted.map((ranking, index) => ({
    ...ranking,
    tier: resolved[index],
  }));
}
