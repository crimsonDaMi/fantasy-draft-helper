interface MonitoringStatusProps {
  draftId?: string;

  draftedPlayerCount?: number;

  generatedAt?: string;

  isLoading: boolean;

  error?: string;

  pollingIntervalMs?: number;
}

export function MonitoringStatus({
  draftId,

  draftedPlayerCount,

  generatedAt,

  isLoading,

  error,

  pollingIntervalMs,
}: MonitoringStatusProps) {
  if (!draftId) {
    return (
      <p>
        Not monitoring a draft.
      </p>
    );
  }

  return (
    <section>
      <h2>
        Monitoring Status
      </h2>

      <p>
        Draft ID: {draftId}
      </p>

      {draftedPlayerCount !== undefined && (
        <p>
          Drafted players:{" "}

          {draftedPlayerCount}
        </p>
      )}

      {generatedAt && (
        <p>
          Last updated:{" "}

          {new Date(
            generatedAt,
          ).toLocaleTimeString()}
        </p>
      )}

      {isLoading && (
        <p>
          {generatedAt
            ? "Refreshing..."
            : "Loading recommendations..."}
        </p>
      )}

      {pollingIntervalMs && (
        <p>
          Polling interval:{" "}

          {pollingIntervalMs / 1000}
          {" seconds"}
        </p>
      )}

      {error && (
        <p>
          Error: {error}
        </p>
      )}
    </section>
  );
}