import {
  SessionLookup,
  User,
  UserRepository,
} from "../repositories/user.repository.js";
import {
  ConflictError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
} from "../utils/domain-errors.js";

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const MAX_REGISTRATIONS_PER_IP = 5;
const REGISTRATION_WINDOW_MS = 60 * 60 * 1000;

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

  // Accounts created per client IP, kept in memory like failed logins.
  // Keyed by IP because a new username can be invented for every signup;
  // behind a proxy this needs TRUST_PROXY so the IP is the client's.
  private readonly registrations = new Map<
    string,
    { count: number; windowStartedAt: number }
  >();

  constructor(
    private readonly repository: UserRepository,
    allowedUsernames: string[] = [],
    private readonly openRegistration = false,
  ) {
    this.allowedUsernames = new Set(allowedUsernames.map(normalizeUsername));
  }

  async register(
    username: string,
    password: string,
    clientIp: string,
  ): Promise<Session> {
    const normalizedUsername = normalizeUsername(username);

    if (
      !this.openRegistration &&
      !this.allowedUsernames.has(normalizedUsername)
    ) {
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

    if (this.hasReachedRegistrationLimit(clientIp)) {
      throw new TooManyRequestsError(
        `Too many accounts created from this network. Try again in ${REGISTRATION_WINDOW_MS / 60_000} minutes.`,
        "TOO_MANY_REGISTRATIONS",
      );
    }

    const user = await this.repository.createUser(normalizedUsername, password);

    this.recordRegistration(clientIp);

    return { user, ...this.repository.createSession(user.id) };
  }

  async login(username: string, password: string): Promise<Session> {
    const user = await this.checkCredentials(username, password);

    return { user, ...this.repository.createSession(user.id) };
  }

  /** Re-checks a logged-in user's password before a destructive action.
   * Shares the login lockout, so it can't be used to guess passwords. */
  async confirmPassword(user: User, password: string): Promise<void> {
    try {
      await this.checkCredentials(user.username, password);
    } catch (error) {
      // 403, not 401: the user is logged in, and the web app treats any
      // 401 as an expired session.
      if (error instanceof UnauthorizedError) {
        throw new ForbiddenError("Incorrect password.", "INVALID_PASSWORD");
      }
      throw error;
    }
  }

  logout(token: string): void {
    this.repository.deleteSession(token);
  }

  getUserForSession(token: string): SessionLookup | undefined {
    return this.repository.getSession(token);
  }

  close(): void {
    this.repository.close();
  }

  private async checkCredentials(
    username: string,
    password: string,
  ): Promise<User> {
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

    return user;
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

  private hasReachedRegistrationLimit(clientIp: string): boolean {
    const entry = this.registrations.get(clientIp);

    return (
      entry !== undefined &&
      Date.now() - entry.windowStartedAt < REGISTRATION_WINDOW_MS &&
      entry.count >= MAX_REGISTRATIONS_PER_IP
    );
  }

  private recordRegistration(clientIp: string): void {
    const now = Date.now();

    // Expired windows are swept here rather than on lookup, so IPs that
    // never come back don't accumulate. Signups are rare enough that a
    // full pass is cheap.
    for (const [ip, entry] of this.registrations) {
      if (now - entry.windowStartedAt >= REGISTRATION_WINDOW_MS) {
        this.registrations.delete(ip);
      }
    }

    const entry = this.registrations.get(clientIp);

    if (entry) {
      entry.count += 1;
    } else {
      this.registrations.set(clientIp, { count: 1, windowStartedAt: now });
    }
  }
}
