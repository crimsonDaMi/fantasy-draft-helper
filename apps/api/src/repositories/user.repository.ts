import {
  createHash,
  randomBytes,
  randomUUID,
  scrypt,
  ScryptOptions,
  timingSafeEqual,
} from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

import { applySchema, openDatabase } from "./database.js";

const SCRYPT_KEY_LENGTH = 64;
const SALT_BYTES = 16;
const DAY_MS = 24 * 60 * 60 * 1000;
// A session expires after this long without use...
export const SESSION_TTL_MS = 30 * DAY_MS;
// ...and this long after login, however often it is used.
export const SESSION_MAX_AGE_MS = 90 * DAY_MS;
// Using a session moves its expiry at most once per this interval, so not
// every request writes to the database.
const SESSION_RENEWAL_INTERVAL_MS = DAY_MS;

export interface ScryptCost {
  log2N: number;
  r: number;
  p: number;
}

// OWASP's minimum for scrypt (128 MiB per hash). Stored with each hash as
// `scrypt$<log2N>$<r>$<p>$<hex>`, so the cost can be raised later without
// invalidating existing passwords.
const SCRYPT_COST: ScryptCost = { log2N: 17, r: 8, p: 1 };

// Node's scrypt defaults, used for hashes stored as plain hex before the
// cost was recorded alongside the hash. Upgraded on the next login.
const LEGACY_SCRYPT_COST: ScryptCost = { log2N: 14, r: 8, p: 1 };

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keyLength: number,
  options: ScryptOptions,
) => Promise<Buffer>;

function parseStoredHash(stored: string): { cost: ScryptCost; hash: string } {
  const parts = stored.split("$");

  if (parts.length === 5 && parts[0] === "scrypt") {
    const [, log2N, r, p, hash] = parts;

    return {
      cost: { log2N: Number(log2N), r: Number(r), p: Number(p) },
      hash,
    };
  }

  return { cost: LEGACY_SCRYPT_COST, hash: stored };
}

function formatStoredHash(cost: ScryptCost, hash: string): string {
  return `scrypt$${cost.log2N}$${cost.r}$${cost.p}$${hash}`;
}

function isSameCost(a: ScryptCost, b: ScryptCost): boolean {
  return a.log2N === b.log2N && a.r === b.r && a.p === b.p;
}

/** Only this hash is stored, so a leaked database or backup doesn't hand
 * out working session tokens. Tokens are 256 random bits, so a fast,
 * unsalted hash is enough. */
function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Hashed against when the username doesn't exist, so a login attempt takes
// the same time either way and doesn't reveal which usernames are taken.
const DUMMY_SALT = randomBytes(SALT_BYTES).toString("hex");

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

const USER_SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    -- Registration, login, or a session renewal (at most daily). Accounts
    -- unused for longer than the retention period are deleted.
    last_active_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
      ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS sessions_user_id
    ON sessions (user_id);
`;

export class UserRepository {
  private readonly database: DatabaseSync;

  /** `scryptCost` is only lowered by tests, which would otherwise spend
   * a third of a second on every registration. */
  constructor(
    databasePath?: string,
    private readonly scryptCost: ScryptCost = SCRYPT_COST,
  ) {
    this.database = openDatabase(databasePath);

    applySchema(this.database, USER_SCHEMA);

    this.deleteExpiredSessions();
  }

  async createUser(username: string, password: string): Promise<User> {
    const id = randomUUID();
    const { salt, hash } = await this.newStoredHash(password);
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
    const row = this.database
      .prepare(
        `SELECT 1 AS found
         FROM users
         WHERE username = ?
         LIMIT 1`,
      )
      .get(username) as unknown as { found: number } | undefined;

    return row !== undefined;
  }

  async verifyPassword(
    username: string,
    password: string,
  ): Promise<User | undefined> {
    const row = this.database
      .prepare(
        `SELECT id, username, password_salt, password_hash
         FROM users
         WHERE username = ?`,
      )
      .get(username) as unknown as
      | {
          id: string;
          username: string;
          password_salt: string;
          password_hash: string;
        }
      | undefined;

    if (!row) {
      await this.hashPassword(password, DUMMY_SALT, this.scryptCost);
      return undefined;
    }

    const { cost, hash } = parseStoredHash(row.password_hash);
    const candidateHash = await this.hashPassword(
      password,
      row.password_salt,
      cost,
    );

    const stored = Buffer.from(hash, "hex");
    const candidate = Buffer.from(candidateHash, "hex");

    if (
      stored.length !== candidate.length ||
      !timingSafeEqual(stored, candidate)
    ) {
      return undefined;
    }

    if (!isSameCost(cost, this.scryptCost)) {
      await this.updatePasswordHash(row.id, password);
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
    const row = this.database
      .prepare(
        `SELECT users.id AS id, users.username AS username,
                sessions.created_at AS created_at, sessions.expires_at AS expires_at
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token = ?`,
      )
      .get(tokenHash) as unknown as
      | { id: string; username: string; created_at: string; expires_at: string }
      | undefined;

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
    const { salt, hash } = await this.newStoredHash(password);

    this.database.exec("BEGIN");
    try {
      this.database
        .prepare(
          `UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?`,
        )
        .run(salt, hash, userId);
      this.database
        .prepare(`DELETE FROM sessions WHERE user_id = ? AND token != ?`)
        .run(userId, hashSessionToken(keepSessionToken));
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
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
    const rows = this.database
      .prepare(`SELECT id FROM users WHERE last_active_at < ?`)
      .all(cutoff.toISOString()) as unknown as { id: string }[];

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

  private async updatePasswordHash(
    userId: string,
    password: string,
  ): Promise<void> {
    const { salt, hash } = await this.newStoredHash(password);

    this.database
      .prepare(
        `UPDATE users SET password_salt = ?, password_hash = ? WHERE id = ?`,
      )
      .run(salt, hash, userId);
  }

  /** A fresh salt and the stored hash of `password` at the current cost. */
  private async newStoredHash(
    password: string,
  ): Promise<{ salt: string; hash: string }> {
    const salt = randomBytes(SALT_BYTES).toString("hex");
    const hash = formatStoredHash(
      this.scryptCost,
      await this.hashPassword(password, salt, this.scryptCost),
    );

    return { salt, hash };
  }

  /** Async so a login doesn't block the event loop (and every other
   * user's draft polling) for the duration of the hash. */
  private async hashPassword(
    password: string,
    salt: string,
    cost: ScryptCost,
  ): Promise<string> {
    const N = 2 ** cost.log2N;
    const hash = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH, {
      N,
      r: cost.r,
      p: cost.p,
      // Node rejects anything above 32 MiB by default; scrypt needs
      // 128 * N * r bytes, plus headroom.
      maxmem: 2 * 128 * N * cost.r,
    });

    return hash.toString("hex");
  }
}
