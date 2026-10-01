// About two fantasy seasons, so skipping one doesn't cost a user their
// rankings.
const DEFAULT_RETENTION_DAYS = 730;

/**
 * Reads ACCOUNT_RETENTION_DAYS: how long an account may go unused before
 * it is deleted. `0` keeps accounts until their owner deletes them.
 * Rejects anything else that isn't a whole number of days, so a typo
 * fails at startup instead of silently changing what gets deleted.
 */
export function parseRetentionDays(value: string | undefined): number {
  const trimmed = value?.trim();

  if (!trimmed) {
    return DEFAULT_RETENTION_DAYS;
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `ACCOUNT_RETENTION_DAYS must be a whole number of days (0 = never), got "${value}".`,
    );
  }

  return Number(trimmed);
}
