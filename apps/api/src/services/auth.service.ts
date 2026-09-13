import {
  User,
  UserRepository,
} from "../repositories/user.repository.js";

export class AllowlistError extends Error { }
export class DuplicateUsernameError extends Error { }
export class InvalidCredentialsError extends Error { }

export class AuthService {
  private readonly repository: UserRepository;
  private readonly allowedUsernames: Set<string>;

  constructor(
    repositoryOrPath: UserRepository | string = new UserRepository(),
    allowedUsernames: string[] = [],
  ) {
    this.repository =
      typeof repositoryOrPath === "string"
        ? new UserRepository(repositoryOrPath)
        : repositoryOrPath;

    this.allowedUsernames = new Set(
      allowedUsernames.map((name) => name.toLowerCase()),
    );
  }

  register(
    username: string,
    password: string,
  ): { user: User; token: string } {
    const normalizedUsername = username.trim().toLowerCase();

    if (!this.allowedUsernames.has(normalizedUsername)) {
      throw new AllowlistError(
        "This username is not on the league allowlist.",
      );
    }

    if (this.repository.usernameExists(normalizedUsername)) {
      throw new DuplicateUsernameError(
        "An account with this username already exists.",
      );
    }

    const user = this.repository.createUser(
      normalizedUsername,
      password,
    );

    const session = this.repository.createSession(user.id);

    return { user, token: session.token };
  }

  login(
    username: string,
    password: string,
  ): { user: User; token: string } {
    const normalizedUsername = username.trim().toLowerCase();

    const user = this.repository.verifyPassword(
      normalizedUsername,
      password,
    );

    if (!user) {
      throw new InvalidCredentialsError(
        "Incorrect username or password.",
      );
    }

    const session = this.repository.createSession(user.id);

    return { user, token: session.token };
  }

  logout(
    token: string,
  ): void {
    this.repository.deleteSession(token);
  }

  getUserForSession(
    token: string,
  ): User | undefined {
    return this.repository.getSession(token);
  }

  close(): void {
    this.repository.close();
  }
}