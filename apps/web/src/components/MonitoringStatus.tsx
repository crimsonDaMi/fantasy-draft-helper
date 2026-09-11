import { isDebugUi } from "../config";

interface MonitoringStatusProps {
  draftId?: string;
  rankingId?: string;
  draftStatus?: "PRE_DRAFT" | "DRAFTING" | "COMPLETE" | "UNKNOWN";
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
      <p className="status-bar">
        Import a ranking and enter a draft ID to begin monitoring.
      </p>
    );
  }

  const isLive = draftStatus === "DRAFTING";
  const statusText = isDebugUi
    ? draftStatus
    : draftStatus === "PRE_DRAFT"
      ? "Waiting for draft to start"
      : draftStatus === "DRAFTING"
        ? "Draft in progress"
        : draftStatus === "COMPLETE"
          ? "Draft complete"
          : "Status unknown";

  return (
    <div>
      <div className="status-bar">
        <span className={`status-bar__dot${isLive ? " status-bar__dot--live" : ""}`} />
        <span>{statusText}</span>

        {draftedPlayerCount !== undefined && (
          <span>
            {draftedPlayerCount}
            {totalPicks !== undefined && ` / ${totalPicks}`} picks
          </span>
        )}

        {isDebugUi && draftId && <span>Draft ID: {draftId}</span>}

        {isDebugUi && lastUpdatedAt && (
          <span>Refresh: {new Date(lastUpdatedAt).toLocaleTimeString()}</span>
        )}

        {isDebugUi && generatedAt && (
          <span>Generated: {new Date(generatedAt).toLocaleTimeString()}</span>
        )}

        {isDebugUi &&
          pollingIntervalMs !== undefined &&
          pollingIntervalMs !== false && (
            <span>Poll: {pollingIntervalMs / 1000}s</span>
          )}

        {isLoading && <span>Loading…</span>}
      </div>

      {lastPick && (
        <p className="status-bar">
          Last pick: #{lastPick.pickNo}
          {lastPick.round !== undefined && ` (round ${lastPick.round})`}
        </p>
      )}

      {error && (
        <div className="status-bar status-bar__error">
          <span>{error}</span>
          <button
            type="button"
            className="status-bar__retry"
            onClick={onRetry}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}