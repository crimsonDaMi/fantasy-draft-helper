/** What this instance tells visitors about itself, for the privacy
 * notice. Read from the environment, so operator details never end up in
 * the repository. */
export interface InstanceInfo {
  /** Unset unless both a name and a contact are configured, so the page
   * never shows half an identity. */
  operator?: {
    name: string;
    contact: string;
    address?: string;
  };
  /** 0 means accounts are kept until their owner deletes them. */
  accountRetentionDays: number;
  /** How long the operator keeps database backups. Unset when they
   * haven't said, and the notice then doesn't mention backups. */
  backupRetentionDays?: number;
}

export function readInstanceInfo(
  env: NodeJS.ProcessEnv,
  accountRetentionDays: number,
  backupRetentionDays?: number,
): InstanceInfo {
  const name = env.OPERATOR_NAME?.trim();
  const contact = env.OPERATOR_CONTACT?.trim();
  const address = env.OPERATOR_ADDRESS?.trim();
  const retention = {
    accountRetentionDays,
    ...(backupRetentionDays === undefined ? {} : { backupRetentionDays }),
  };

  if (!name || !contact) {
    return retention;
  }

  return {
    operator: { name, contact, ...(address ? { address } : {}) },
    ...retention,
  };
}
