/** "R" tag next to a rookie's name. Renders nothing for anyone else,
 * including players whose experience Sleeper doesn't know. */
export function RookieBadge({ rookie }: { rookie?: boolean }) {
  if (!rookie) {
    return null;
  }

  return (
    <span className="rookie-badge" title="Rookie" aria-label="Rookie">
      R
    </span>
  );
}
