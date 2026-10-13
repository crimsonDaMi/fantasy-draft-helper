import { numericTierToLabel } from "./tier.js";

/** Tiers a ranking started from ADP gets; leaves room under the 26-tier
 * limit to add tiers in the editor. */
const ADP_TIER_COUNT = 20;
/** Added to ADP before taking its log, about one draft round: tiers widen
 * as the draft goes on without each first-round pick getting its own. */
const LOG_OFFSET = 12;

/**
 * Splits ADP values, sorted ascending, into tiers by natural breaks
 * (Jenks): the split into at most 20 tiers with the smallest total
 * within-tier variance of log(ADP + 12). Boundaries land on the widest
 * ADP gaps, judged relative to draft position (two picks matter in round
 * one, not in round fifteen). Players with the same ADP share a tier.
 * Returns each value's tier label (S, A, B, ...), in input order.
 */
export function adpTiers(sortedAdp: readonly number[]): string[] {
  const n = sortedAdp.length;
  const x = sortedAdp.map((adp) => Math.log(adp + LOG_OFFSET));
  // A tier may only start where the ADP changes.
  const canStart = x.map((value, i) => i === 0 || value > x[i - 1]!);
  const tierCount = Math.min(ADP_TIER_COUNT, canStart.filter(Boolean).length);

  if (tierCount <= 1) {
    return sortedAdp.map(() => numericTierToLabel(1)!);
  }

  const sum = [0];
  const sumOfSquares = [0];

  for (const value of x) {
    sum.push(sum.at(-1)! + value);
    sumOfSquares.push(sumOfSquares.at(-1)! + value * value);
  }

  /** Sum of squared deviations of x[from..to). */
  const cost = (from: number, to: number) => {
    const s = sum[to]! - sum[from]!;
    return sumOfSquares[to]! - sumOfSquares[from]! - (s * s) / (to - from);
  };

  // best[t][j]: lowest cost of splitting x[0..j) into t tiers; start[t][j]:
  // where the last of those tiers starts.
  const best = Array.from({ length: tierCount + 1 }, () =>
    Array.from<number>({ length: n + 1 }).fill(Infinity),
  );
  const start = Array.from({ length: tierCount + 1 }, () =>
    Array.from<number>({ length: n + 1 }).fill(0),
  );
  best[0]![0] = 0;

  for (let t = 1; t <= tierCount; t++) {
    for (let j = t; j <= n; j++) {
      if (j < n && !canStart[j]) continue;

      for (let i = t - 1; i < j; i++) {
        if (!canStart[i]) continue;

        const total = best[t - 1]![i]! + cost(i, j);

        if (total < best[t]![j]!) {
          best[t]![j] = total;
          start[t]![j] = i;
        }
      }
    }
  }

  const tiers = Array.from<string>({ length: n });
  let end = n;

  for (let t = tierCount; t >= 1; t--) {
    const from = start[t]![end]!;
    tiers.fill(numericTierToLabel(t)!, from, end);
    end = from;
  }

  return tiers;
}
