const explicitUiMode = import.meta.env.VITE_UI_MODE;

export const UI_MODE: "debug" | "draft" =
  explicitUiMode === "debug"
    ? "debug"
    : explicitUiMode === "draft"
      ? "draft"
      : import.meta.env.DEV
        ? "debug"
        : "draft";

export const isDebugUi = UI_MODE === "debug";

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