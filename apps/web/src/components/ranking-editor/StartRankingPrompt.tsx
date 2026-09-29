/** Shown when the user has no ranking yet. */
export function StartRankingPrompt({
  isStarting,
  hasFailed,
  onStart,
}: {
  isStarting: boolean;
  hasFailed: boolean;
  onStart: () => void;
}) {
  return (
    <section className="ranking-editor">
      <h2>Edit rankings</h2>
      <p>
        Import a ranking on the Draft tab, or start a new one here and build it
        from scratch.
      </p>
      <button
        type="button"
        className="ranking-editor__start-new"
        onClick={onStart}
        disabled={isStarting}
      >
        {isStarting ? "Starting…" : "Start a new ranking"}
      </button>
      {hasFailed && (
        <p className="status-bar status-bar__error">
          Failed to start a new ranking. Try again.
        </p>
      )}
    </section>
  );
}
