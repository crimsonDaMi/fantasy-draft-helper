/** "Last" tag after a tier label, on the only player of their position
 * left in that tier. Renders nothing for anyone else. */
export function LastInTierBadge({
  lastInTier,
  position,
  tier,
}: {
  lastInTier?: boolean;
  position?: string;
  tier: string;
}) {
  if (!lastInTier) {
    return null;
  }

  const label = `Last ${position ?? "player"} left in tier ${tier}`;

  return (
    <span className="last-in-tier-badge" title={label} aria-label={label}>
      Last
    </span>
  );
}
