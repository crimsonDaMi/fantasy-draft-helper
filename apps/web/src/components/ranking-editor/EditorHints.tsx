/** Getting-started hints. Derived from the ranking's state, so they come
 * back if the ranking returns to that state. */
export function EditorHints({
  isPhone,
  hasAnyRankedPlayers,
  hasOnlyOneTier,
}: {
  isPhone: boolean;
  hasAnyRankedPlayers: boolean;
  hasOnlyOneTier: boolean;
}) {
  if (hasAnyRankedPlayers && !hasOnlyOneTier && isPhone) {
    return null;
  }

  return (
    <div className="ranking-editor__hints">
      {!hasAnyRankedPlayers && (
        <p className="ranking-editor__hint">
          {isPhone
            ? "Tap a player in Unranked to add them to a tier."
            : "Drag players from the Unranked panel into a tier to start ranking them."}
        </p>
      )}
      {hasOnlyOneTier && (
        <p className="ranking-editor__hint">
          Use "+ Add tier here" to create more tiers.
        </p>
      )}
      {!isPhone && (
        <p className="ranking-editor__hint">
          Keyboard: ↑/↓ to pick a player, Enter to move them to a tier, Alt+↑/↓
          to move them one place.
        </p>
      )}
    </div>
  );
}
