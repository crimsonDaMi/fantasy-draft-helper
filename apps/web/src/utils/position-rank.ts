/** A positional rank label like `WR12`, or undefined when either part
 * is unknown. */
export function formatPositionRank(
  position: string | undefined,
  rank: number | undefined,
): string | undefined {
  return position && rank !== undefined ? `${position}${rank}` : undefined;
}
