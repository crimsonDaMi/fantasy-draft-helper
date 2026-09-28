/** Short labels for Sleeper's `injury_status` values; anything else
 * falls back to its first three letters. */
const SHORT_LABELS: Record<string, string> = {
  questionable: "Q",
  doubtful: "D",
  out: "O",
  ir: "IR",
  pup: "PUP",
  sus: "SUS",
  cov: "COV",
  na: "NA",
  dnr: "DNR",
};

/** Injury/availability tag next to a player's name. Renders nothing for
 * a healthy player. Questionable is a softer warning; everything else
 * means the player won't (or may not) play. */
export function InjuryBadge({ status }: { status?: string }) {
  if (!status) {
    return null;
  }

  const key = status.toLowerCase();
  const label = SHORT_LABELS[key] ?? status.slice(0, 3).toUpperCase();
  const variant = key === "questionable" ? "minor" : "major";

  return (
    <span
      className={`injury-badge injury-badge--${variant}`}
      title={status}
      aria-label={`Injury status: ${status}`}
    >
      {label}
    </span>
  );
}
