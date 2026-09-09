import {
  isDebugUi
} from "../config";

interface MonitoringStatusProps {
  draftId?: string;

  rankingId?: string;

  draftStatus?:
  | "PRE_DRAFT"
  | "DRAFTING"
  | "COMPLETE"
  | "UNKNOWN";

  totalPicks?: number;

  draftedPlayerCount?: number;

  lastPick?: {
    playerId: string;
    pickNo: number;
    round?: number;
  };

  generatedAt?: string;

  lastUpdatedAt?: string;

  isLoading: boolean;

  error?: string;

  onRetry: () => void;

  pollingIntervalMs?: number | false;
}

export function MonitoringStatus({
  draftId,

  rankingId,

  draftStatus,

  totalPicks,

  draftedPlayerCount,

  lastPick,

  generatedAt,

  lastUpdatedAt,

  isLoading,

  error,

  onRetry,

  pollingIntervalMs,
}: MonitoringStatusProps) {
  if (!draftId || !rankingId) {
    return (
      <p>
        Import a ranking and enter a draft ID to begin monitoring.
      </p>
    );
  }

  return (
    <section>
      <h2>
        Monitoring Status
      </h2>

      {isDebugUi && (
        <p>
          Draft ID: {draftId}</p>
      )}

      {draftStatus && (
        <p>
          {isDebugUi ? "Draft status: " : ""}
          {isDebugUi
            ? draftStatus
            : draftStatus === "PRE_DRAFT"
              ? "Waiting for the draft to start…"
              : draftStatus === "DRAFTING"
                ? "Draft in progress"
                : draftStatus === "COMPLETE"
                  ? "Draft complete"
                  : "Status unknown"}
        </p>
      )}

      {draftedPlayerCount !== undefined && (
        <p>
          Picks: {draftedPlayerCount}
          {totalPicks !== undefined && ` / ${totalPicks}`}
        </p>
      )}

      {lastPick && (
        <p>
          Last pick: #{lastPick.pickNo}
          {lastPick.round !== undefined && ` (round ${lastPick.round})`}
        </p>
      )}

      {isDebugUi && lastUpdatedAt && (
        <p>
          Sleeper refresh: {new Date(lastUpdatedAt).toLocaleTimeString()}
        </p>
      )}

      {isDebugUi && generatedAt && (
        <p>
          Generated: {new Date(generatedAt).toLocaleTimeString()}
        </p>
      )}

      {isLoading &&
        <p>
          Loading recommendations...
        </p>
      }

      {isDebugUi &&
        pollingIntervalMs !== undefined &&
        pollingIntervalMs !== false && (
          <p>
            Polling interval: {pollingIntervalMs / 1000} seconds
          </p>
        )}

      {draftStatus === "COMPLETE" && (
        <p>
          Draft complete. Monitoring stopped.
        </p>
      )}

      {error && (
        <div>
          <p>
            Error: {error}
          </p>

          <p>
            Check the draft ID, then submit it again to resume monitoring.
          </p>

          <button
            type="button"
            onClick={onRetry}
          >
            Retry monitoring
          </button>
        </div>
      )}
    </section>
  );
}