import { User, UserRepository } from "../repositories/user.repository.js";

export class AllowlistError extends Error {}
export class DuplicateUsernameError extends Error {}
export class InvalidCredentialsError extends Error {}

/** Usernames are case-insensitive and whitespace-trimmed everywhere. */
function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

export class AuthService {
  private readonly allowedUsernames: Set<string>;

  constructor(
    private readonly repository: UserRepository,
    allowedUsernames: string[] = [],
  ) {
    this.allowedUsernames = new Set(allowedUsernames.map(normalizeUsername));
  }

  register(username: string, password: string): { user: User; token: string } {
    const normalizedUsername = normalizeUsername(username);

    if (!this.allowedUsernames.has(normalizedUsername)) {
      throw new AllowlistError("This username is not on the league allowlist.");
    }

    if (this.repository.usernameExists(normalizedUsername)) {
      throw new DuplicateUsernameError(
        "An account with this username already exists.",
      );
    }

    const user = this.repository.createUser(normalizedUsername, password);

    const session = this.repository.createSession(user.id);

    return { user, token: session.token };
  }

  login(username: string, password: string): { user: User; token: string } {
    const normalizedUsername = normalizeUsername(username);

    const user = this.repository.verifyPassword(normalizedUsername, password);

    if (!user) {
      throw new InvalidCredentialsError("Incorrect username or password.");
    }

    const session = this.repository.createSession(user.id);

    return { user, token: session.token };
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
}
