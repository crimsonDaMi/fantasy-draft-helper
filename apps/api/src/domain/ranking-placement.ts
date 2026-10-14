import { PlayerMatch } from "./player-match.js";
import { labelTierToNumeric } from "../utils/tier.js";

// Where the ranking editor places a row in a ranking's rows (matched and
// unmatched, in rank order). Unmatched rows aren't in the editor's
// tiers, so positions and tiers are judged by the matched rows only.

/** Index in `ordered` of the `matchedRank`-th (1-based) matched row, or
 * the end of the list when there are fewer matched rows. */
export function indexOfMatchedRank(
  ordered: PlayerMatch[],
  matchedRank: number,
): number {
  let seen = 0;

  for (const [index, match] of ordered.entries()) {
    if (match.player && ++seen === Math.max(1, matchedRank)) {
      return index;
    }
  }

  return ordered.length;
}

/** `preferred` if it sorts between the tiers of the nearest matched rows
 * around `index`, else the tier of the matched row above (or below). */
export function fittingTier(
  ordered: PlayerMatch[],
  index: number,
  preferred: string | undefined,
): string | undefined {
  const above = ordered
    .slice(0, index)
    .reverse()
    .find((match) => match.player)?.ranking.tier;
  const below = ordered.slice(index + 1).find((match) => match.player)
    ?.ranking.tier;
  const order = (tier: string | undefined) =>
    tier === undefined ? undefined : labelTierToNumeric(tier);
  const preferredOrder = order(preferred);

  if (
    preferredOrder !== undefined &&
    preferredOrder >= (order(above) ?? 0) &&
    preferredOrder <= (order(below) ?? Infinity)
  ) {
    return preferred;
  }

  return above ?? below ?? preferred;
}
