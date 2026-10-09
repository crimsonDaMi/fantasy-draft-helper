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
import { WindowCounter } from "../utils/window-counter.js";

// Failed logins for one username from one client IP.
const MAX_FAILED_LOGINS_PER_IP = 5;
// Failed logins for one username from all IPs together: high enough that
// a single network can't lock a user out, low enough to slow down a
// guessing attack spread across many addresses.
const MAX_FAILED_LOGINS_PER_ACCOUNT = 50;
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

  // Failed logins per username and client IP, so a wrong password from one
  // network only locks that network out of the account. Behind a proxy
  // this needs TRUST_PROXY; otherwise every request has the proxy's IP and
  // this acts like a per-username lockout.
  private readonly failedLoginsPerIp = new WindowCounter(LOCKOUT_WINDOW_MS);

  // Failed logins per username from all IPs, with a much higher limit.
  private readonly failedLoginsPerAccount = new WindowCounter(
    LOCKOUT_WINDOW_MS,
  );

  // Accounts created per client IP. Keyed by IP because a new username can
  // be invented for every signup; behind a proxy this needs TRUST_PROXY so
  // the IP is the client's.
  private readonly registrations = new WindowCounter(REGISTRATION_WINDOW_MS);

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

    if (this.registrations.count(clientIp) >= MAX_REGISTRATIONS_PER_IP) {
      throw new TooManyRequestsError(
        `Too many accounts created from this network. Try again in ${REGISTRATION_WINDOW_MS / 60_000} minutes.`,
        "TOO_MANY_REGISTRATIONS",
      );
    }

    const user = await this.repository.createUser(normalizedUsername, password);

    this.registrations.record(clientIp);

    return { user, ...this.repository.createSession(user.id) };
  }

  async login(
    username: string,
    password: string,
    clientIp: string,
  ): Promise<Session> {
    const user = await this.checkCredentials(username, password, clientIp);

    return { user, ...this.repository.createSession(user.id) };
  }

  /** Re-checks a logged-in user's password before a destructive action.
   * Shares the login lockout, so it can't be used to guess passwords. */
  async confirmPassword(
    user: User,
    password: string,
    clientIp: string,
  ): Promise<void> {
    try {
      await this.checkCredentials(user.username, password, clientIp);
    } catch (error) {
      // 403, not 401: the user is logged in, and the web app treats any
      // 401 as an expired session.
      if (error instanceof UnauthorizedError) {
        throw new ForbiddenError("Incorrect password.", "INVALID_PASSWORD");
      }
      throw error;
    }
  }

  /** Changes a logged-in user's password after re-checking the current
   * one, and logs out every other session. */
  async changePassword(
    user: User,
    currentPassword: string,
    newPassword: string,
    currentSessionToken: string,
    clientIp: string,
  ): Promise<void> {
    await this.confirmPassword(user, currentPassword, clientIp);

    await this.repository.changePassword(
      user.id,
      newPassword,
      currentSessionToken,
    );
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
    clientIp: string,
  ): Promise<User> {
    const normalizedUsername = normalizeUsername(username);
    // A space can't appear in an IP address, so the key is unambiguous.
    const ipKey = `${clientIp} ${normalizedUsername}`;

    if (
      this.failedLoginsPerIp.count(ipKey) >= MAX_FAILED_LOGINS_PER_IP ||
      this.failedLoginsPerAccount.count(normalizedUsername) >=
        MAX_FAILED_LOGINS_PER_ACCOUNT
    ) {
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
      this.failedLoginsPerIp.record(ipKey);
      this.failedLoginsPerAccount.record(normalizedUsername);
      throw new UnauthorizedError(
        "Incorrect username or password.",
        "INVALID_CREDENTIALS",
      );
    }

    // Only this network's count: the account-wide one keeps running, so a
    // spread-out attack doesn't start over whenever the owner logs in.
    this.failedLoginsPerIp.clear(ipKey);

    return user;
  }
}
