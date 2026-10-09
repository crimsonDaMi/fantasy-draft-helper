// About two fantasy seasons, so skipping one doesn't cost a user their
// rankings.
const DEFAULT_RETENTION_DAYS = 730;

/** Whole days from an environment variable, or undefined when unset.
 * Rejects anything else, so a typo fails at startup instead of silently
 * changing what gets deleted or what the privacy notice says. */
function parseWholeDays(
  name: string,
  value: string | undefined,
  hint: string,
): number | undefined {
  const trimmed = value?.trim();

  if (!trimmed) {
    return undefined;
  }

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(
      `${name} must be a whole number of days (${hint}), got "${value}".`,
    );
  }

  return Number(trimmed);
}

/**
 * Reads ACCOUNT_RETENTION_DAYS: how long an account may go unused before
 * it is deleted. `0` keeps accounts until their owner deletes them.
 */
export function parseRetentionDays(value: string | undefined): number {
  return (
    parseWholeDays("ACCOUNT_RETENTION_DAYS", value, "0 = never") ??
    DEFAULT_RETENTION_DAYS
  );
}

/**
 * Reads BACKUP_RETENTION_DAYS: how long the operator keeps backups of the
 * database. The app makes no backups itself; this only lets the privacy
 * notice say how long deleted data can survive in them. Unset means the
 * notice doesn't mention backups.
 */
export function parseBackupRetentionDays(
  value: string | undefined,
): number | undefined {
  const days = parseWholeDays("BACKUP_RETENTION_DAYS", value, "at least 1");

  if (days === 0) {
    throw new Error(
      `BACKUP_RETENTION_DAYS must be a whole number of days (at least 1), got "${value}". Leave it unset if you keep no backups.`,
    );
  }

  return days;
}
