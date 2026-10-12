import { AdpRankingStart } from "../AdpRankingStart";
import { ErrorMessage } from "../ErrorMessage";

/** Shown when the user has no ranking yet. */
export function StartRankingPrompt({
  isStarting,
  error,
  onStart,
  onCreatedFromAdp,
}: {
  isStarting: boolean;
  error: Error | null;
  onStart: () => void;
  onCreatedFromAdp: (rankingId: string) => void;
}) {
  return (
    <section className="ranking-editor">
      <h2>Edit rankings</h2>
      <p>
        Import a ranking on the Draft tab, start one from Sleeper ADP, or start
        an empty one here and build it from scratch.
      </p>
      <button
        type="button"
        className="ranking-editor__start-new"
        onClick={onStart}
        disabled={isStarting}
      >
        {isStarting ? "Starting…" : "Start a new ranking"}
      </button>
      {error && (
        <ErrorMessage>
          Couldn't start a new ranking: {error.message}
        </ErrorMessage>
      )}
      <AdpRankingStart onCreated={onCreatedFromAdp} />
    </section>
  );
}
