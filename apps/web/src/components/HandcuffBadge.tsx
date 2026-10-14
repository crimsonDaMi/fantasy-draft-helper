/** "Handcuff" tag on the RB directly behind an RB the user drafted on
 * their team's depth chart. Renders nothing without one. */
export function HandcuffBadge({ starters }: { starters: string[] }) {
  if (starters.length === 0) {
    return null;
  }

  const label = `Handcuff: ${starters.join(", ")}`;

  return (
    <span className="handcuff-badge" title={label} aria-label={label}>
      Handcuff
    </span>
  );
}
