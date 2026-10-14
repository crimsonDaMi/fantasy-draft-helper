import { createHash, randomBytes, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  migrate,
  openDatabase,
  queryAll,
  queryOne,
  resolveDatabasePath,
  runInTransaction,
  VersionedSchema,
} from "./database.js";
import {
  hashDummyPassword,
  hashNewPassword,
  SCRYPT_COST,
  type ScryptCost,
  verifyStoredPassword,
} from "../utils/password-hash.js";
import { DAY_MS } from "../utils/time.js";

// A session expires after this long without use...
export const SESSION_TTL_MS = 30 * DAY_MS;
// ...and this long after login, however often it is used.
export const SESSION_MAX_AGE_MS = 90 * DAY_MS;
// Using a session moves its expiry at most once per this interval, so not
// every request writes to the database.
const SESSION_RENEWAL_INTERVAL_MS = DAY_MS;

/** Only this hash is stored, so a leaked database or backup doesn't hand
 * out working session tokens. Tokens are 256 random bits, so a fast,
 * unsalted hash is enough. */
function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface User {
  id: string;
  username: string;
}

export interface SessionLookup {
  user: User;
  /** Set when this lookup extended the session, so the cookie needs the
   * new expiry too. */
  renewedExpiresAt?: string;
}

// Add a schema change as a new step at the end; a step that has shipped
// never changes (see AGENTS.md).
const USER_SCHEMA: VersionedSchema = {
  name: "users",
  migrations: [
    {
      version: 1,
      up: `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    -- Registration, login, or a session renewal (at most daily). Accounts
    -- unused for longer than the retention period are deleted.
    last_active_at TEXT NOT NULL
  );

  CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  );

  CREATE INDEX sessions_user_id
    ON sessions (user_id);
      `,
    },
  ],
};

export class UserRepository {
  private readonly database: DatabaseSync;

  /** `scryptCost` is only lowered by tests, which would otherwise spend
   * a third of a second on every registration. */
  constructor(
    databasePath?: string,
    private readonly scryptCost: ScryptCost = SCRYPT_COST,
  ) {
    const path = resolveDatabasePath(databasePath);
    this.database = openDatabase(path);

    migrate(this.database, USER_SCHEMA, path);

    this.deleteExpiredSessions();
  }

  async createUser(username: string, password: string): Promise<User> {
    const id = randomUUID();
    const { salt, hash } = await hashNewPassword(password, this.scryptCost);
    const createdAt = new Date().toISOString();

    this.database
      .prepare(
        `INSERT INTO users (id, username, password_salt, password_hash, created_at, last_active_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, username, salt, hash, createdAt, createdAt);

    return { id, username };
  }

  usernameExists(username: string): boolean {
    const row = queryOne<{ found: number }>(
      this.database,
      `SELECT 1 AS found
       FROM users
       WHERE username = ?
       LIMIT 1`,
      username,
    );

    return row !== undefined;
  }

  async verifyPassword(
    username: string,
    password: string,
  ): Promise<User | undefined> {
    const row = queryOne<{
      id: string;
      username: string;
      password_salt: string;
      password_hash: string;
    }>(
      this.database,
      `SELECT id, username, password_salt, password_hash
       FROM users
       WHERE username = ?`,
      username,
    );

    if (!row) {
      await hashDummyPassword(password, this.scryptCost);
      return undefined;
    }

    const { matches, needsRehash } = await verifyStoredPassword(
      password,
      row.password_salt,
      row.password_hash,
      this.scryptCost,
    );

    if (!matches) {
      return undefined;
    }

    if (needsRehash) {
      const { salt, hash } = await hashNewPassword(password, this.scryptCost);

      this.writePasswordHash(row.id, salt, hash);
    }

    return { id: row.id, username: row.username };
  }

  createSession(userId: string): { token: string; expiresAt: string } {
    // Sessions are otherwise only deleted on logout or when an expired one
    // is presented, so abandoned ones would accumulate forever.
    this.deleteExpiredSessions();

    const token = randomBytes(32).toString("hex");
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_MS);

    this.database
      .prepare(
        `INSERT INTO sessions (token, user_id, created_at, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        hashSessionToken(token),
        userId,
        createdAt.toISOString(),
        expiresAt.toISOString(),
      );

    this.markActive(userId, createdAt);

    return {
      token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /** The session's user, sliding its expiry forward while it is in use
   * (see SESSION_TTL_MS and SESSION_MAX_AGE_MS). */
  getSession(token: string): SessionLookup | undefined {
    const tokenHash = hashSessionToken(token);
    const row = queryOne<{
      id: string;
      username: string;
      created_at: string;
      expires_at: string;
    }>(
      this.database,
      `SELECT users.id AS id, users.username AS username,
              sessions.created_at AS created_at, sessions.expires_at AS expires_at
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?`,
      tokenHash,
    );

    if (!row) {
      return undefined;
    }

    const now = Date.now();
    const expiresAt = new Date(row.expires_at).getTime();

    if (expiresAt < now) {
      this.deleteSession(token);
      return undefined;
    }

    const user = { id: row.id, username: row.username };
    const renewedExpiresAt = Math.min(
      now + SESSION_TTL_MS,
      new Date(row.created_at).getTime() + SESSION_MAX_AGE_MS,
    );

    if (renewedExpiresAt - expiresAt < SESSION_RENEWAL_INTERVAL_MS) {
      return { user };
    }

    const renewedExpiresAtIso = new Date(renewedExpiresAt).toISOString();

    this.database
      .prepare(`UPDATE sessions SET expires_at = ? WHERE token = ?`)
      .run(renewedExpiresAtIso, tokenHash);

    this.markActive(user.id, new Date(now));

    return { user, renewedExpiresAt: renewedExpiresAtIso };
  }

  /** Replaces the user's password and ends every session except the one
   * with `keepSessionToken`, so a stolen or forgotten-about login elsewhere
   * stops working. */
  async changePassword(
    userId: string,
    password: string,
    keepSessionToken: string,
  ): Promise<void> {
    const { salt, hash } = await hashNewPassword(password, this.scryptCost);

    runInTransaction(this.database, () => {
      this.writePasswordHash(userId, salt, hash);
      this.database
        .prepare(`DELETE FROM sessions WHERE user_id = ? AND token != ?`)
        .run(userId, hashSessionToken(keepSessionToken));
    });
  }

  deleteSession(token: string): void {
    this.database
      .prepare(`DELETE FROM sessions WHERE token = ?`)
      .run(hashSessionToken(token));
  }

  /** Deletes the user; their sessions go with them (FK cascade). Their
   * rankings live in another repository and must be deleted first. */
  deleteUser(userId: string): void {
    this.database.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
  }

  /** Users whose last activity is older than `cutoff`. */
  listInactiveUserIds(cutoff: Date): string[] {
    const rows = queryAll<{ id: string }>(
      this.database,
      `SELECT id FROM users WHERE last_active_at < ?`,
      cutoff.toISOString(),
    );

    return rows.map((row) => row.id);
  }

  deleteExpiredSessions(): void {
    this.database
      .prepare(`DELETE FROM sessions WHERE expires_at < ?`)
      .run(new Date().toISOString());
  }

  close(): void {
    this.database.close();
  }

  private markActive(userId: string, at: Date): void {
    this.database
      .prepare(`UPDATE users SET last_active_at = ? WHERE id = ?`)
      .run(at.toISOString(), userId);
  }

  private writePasswordHash(userId: string, salt: string, hash: string): void {
    this.database
      .prepare(
        `UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?`,
      )
      .run(salt, hash, userId);
  }
}
