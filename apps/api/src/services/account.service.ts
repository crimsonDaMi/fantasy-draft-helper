import type { FastifyBaseLogger } from "fastify";

import { RankingRepository } from "../repositories/ranking.repository.js";
import { User, UserRepository } from "../repositories/user.repository.js";
import { AuthService } from "./auth.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Deletes accounts with everything tied to them, on request or after
 * `retentionDays` without use (0 keeps accounts until deleted). Rankings
 * have no foreign key to users, since the two can live in separate
 * database files, so they are deleted explicitly, and first: an
 * interruption then leaves at most an empty account, never rankings
 * without an owner.
 */
export class AccountService {
  constructor(
    private readonly authService: AuthService,
    private readonly userRepository: UserRepository,
    private readonly rankingRepository: RankingRepository,
    private readonly retentionDays: number,
    private readonly logger: FastifyBaseLogger,
  ) {}

  get purgesInactiveAccounts(): boolean {
    return this.retentionDays > 0;
  }

  async deleteAccount(user: User, password: string): Promise<void> {
    await this.authService.confirmPassword(user, password);

    this.deleteUserData(user.id);
  }

  /** Deletes every account unused for longer than the retention period
   * and returns how many were deleted. */
  purgeInactiveAccounts(now = new Date()): number {
    if (!this.purgesInactiveAccounts) {
      return 0;
    }

    const cutoff = new Date(now.getTime() - this.retentionDays * DAY_MS);
    const userIds = this.userRepository.listInactiveUserIds(cutoff);

    for (const userId of userIds) {
      this.deleteUserData(userId);
    }

    if (userIds.length > 0) {
      this.logger.info(
        { count: userIds.length, retentionDays: this.retentionDays },
        "Deleted inactive accounts",
      );
    }

    return userIds.length;
  }

  private deleteUserData(userId: string): void {
    this.rankingRepository.deleteAllForUser(userId);
    this.userRepository.deleteUser(userId);
  }
}
