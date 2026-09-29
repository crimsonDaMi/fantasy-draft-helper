import { User, UserRepository } from "../repositories/user.repository.js";
import {
  ConflictError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
} from "../utils/domain-errors.js";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

interface Session {
  user: User;
  token: string;
  expiresAt: string;
}

/** Usernames are case-insensitive and whitespace-trimmed everywhere. */
function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export class AuthService {
  private readonly allowedUsernames: Set<string>;

  // Failed logins per username, kept in memory (a restart resets them).
  // Keyed by username rather than IP: behind a reverse proxy or tunnel
  // every request can arrive from the same proxy address.
  private readonly failedLogins = new Map<
    string,
    { count: number; windowStartedAt: number }
  >();

  constructor(
    private readonly repository: UserRepository,
    allowedUsernames: string[] = [],
  ) {
    this.allowedUsernames = new Set(allowedUsernames.map(normalizeUsername));
  }

  async register(username: string, password: string): Promise<Session> {
    const normalizedUsername = normalizeUsername(username);

    if (!this.allowedUsernames.has(normalizedUsername)) {
      throw new ForbiddenError(
        "This username is not on the league allowlist.",
        "NOT_ALLOWLISTED",
      );
    }

    if (this.repository.usernameExists(normalizedUsername)) {
      throw new ConflictError(
        "An account with this username already exists.",
        "USERNAME_TAKEN",
      );
    }

    const user = await this.repository.createUser(normalizedUsername, password);

    return { user, ...this.repository.createSession(user.id) };
  }

  async login(username: string, password: string): Promise<Session> {
    const normalizedUsername = normalizeUsername(username);

    if (this.isLockedOut(normalizedUsername)) {
      throw new TooManyRequestsError(
        `Too many failed login attempts. Try again in ${LOCKOUT_WINDOW_MS / 60_000} minutes.`,
        "TOO_MANY_LOGIN_ATTEMPTS",
      );
    }

    const user = await this.repository.verifyPassword(
      normalizedUsername,
      password,
    );

    if (!user) {
      this.recordFailedLogin(normalizedUsername);
      throw new UnauthorizedError(
        "Incorrect username or password.",
        "INVALID_CREDENTIALS",
      );
    }

    this.failedLogins.delete(normalizedUsername);

    return { user, ...this.repository.createSession(user.id) };
  }

  logout(token: string): void {
    this.repository.deleteSession(token);
  }

  getUserForSession(token: string): User | undefined {
    return this.repository.getSession(token);
  }

  close(): void {
    this.repository.close();
  }

  private isLockedOut(username: string): boolean {
    const entry = this.failedLogins.get(username);

    if (!entry) {
      return false;
    }

    if (Date.now() - entry.windowStartedAt >= LOCKOUT_WINDOW_MS) {
      this.failedLogins.delete(username);
      return false;
    }

    return entry.count >= MAX_FAILED_LOGINS;
  }

  private recordFailedLogin(username: string): void {
    const entry = this.failedLogins.get(username);

    if (entry) {
      entry.count += 1;
    } else {
      this.failedLogins.set(username, {
        count: 1,
        windowStartedAt: Date.now(),
      });
    }
  }
}
