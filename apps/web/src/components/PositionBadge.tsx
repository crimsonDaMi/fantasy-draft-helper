import { POSITIONS } from "../utils/positions";

/** Color-coded position tag. Always rendered (empty when the position is
 * unknown) so it forms a fixed-width column across rows. */
export function PositionBadge({ position }: { position?: string }) {
  const variant =
    position && (POSITIONS as readonly string[]).includes(position)
      ? position.toLowerCase()
      : "other";

  return (
    <span className={`position-badge position-badge--${variant}`}>
      {position}
    </span>
  );
}
