/** "Stack: BUF" tag on a player who shares an NFL team with a QB, WR or
 * TE the user drafted. Renders nothing without partners. */
export function StackBadge({
  team,
  partners,
}: {
  team?: string;
  partners: string[];
}) {
  if (!team || partners.length === 0) {
    return null;
  }

  const label = `Stacks with ${partners.join(", ")}`;

  return (
    <span className="stack-badge" title={label} aria-label={label}>
      Stack: {team}
    </span>
  );
}
