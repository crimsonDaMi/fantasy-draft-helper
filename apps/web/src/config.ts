const configuredActivePollingInterval =
  Number(
    import.meta.env
      .VITE_POLLING_INTERVAL_MS,
  );

export const ACTIVE_POLLING_INTERVAL_MS =
  Number.isFinite(
    configuredActivePollingInterval,
  ) &&
    configuredActivePollingInterval > 0
    ? configuredActivePollingInterval
    : 3_000;

export const PRE_DRAFT_POLLING_INTERVAL_MS =
  30_000;