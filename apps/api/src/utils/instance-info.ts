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
}

export function readInstanceInfo(
  env: NodeJS.ProcessEnv,
  accountRetentionDays: number,
): InstanceInfo {
  const name = env.OPERATOR_NAME?.trim();
  const contact = env.OPERATOR_CONTACT?.trim();
  const address = env.OPERATOR_ADDRESS?.trim();

  if (!name || !contact) {
    return { accountRetentionDays };
  }

  return {
    operator: { name, contact, ...(address ? { address } : {}) },
    accountRetentionDays,
  };
}
