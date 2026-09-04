const configuredPollingInterval =
  Number(
    import.meta.env
      .VITE_POLLING_INTERVAL_MS,
  );

export const POLLING_INTERVAL_MS =
  Number.isFinite(
    configuredPollingInterval,
  ) &&
    configuredPollingInterval > 0
    ? configuredPollingInterval
    : 3_000;