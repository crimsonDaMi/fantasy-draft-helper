import { randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

import { applySchema, openDatabase } from "./database.js";

const SCRYPT_KEY_LENGTH = 64;
const SALT_BYTES = 16;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keyLength: number,
) => Promise<Buffer>;

// Hashed against when the username doesn't exist, so a login attempt takes
// the same time either way and doesn't reveal which usernames are taken.
const DUMMY_SALT = randomBytes(SALT_BYTES).toString("hex");

export interface User {
  id: string;
  username: string;
}

const USER_SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
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

  constructor(databasePath?: string) {
    this.database = openDatabase(databasePath);

    applySchema(this.database, USER_SCHEMA);

    this.deleteExpiredSessions();
  }

  async createUser(username: string, password: string): Promise<User> {
    const id = randomUUID();
    const salt = randomBytes(SALT_BYTES).toString("hex");
    const hash = await this.hashPassword(password, salt);
    const createdAt = new Date().toISOString();

    this.database
      .prepare(
        `INSERT INTO users (id, username, password_salt, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, username, salt, hash, createdAt);

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
      await this.hashPassword(password, DUMMY_SALT);
      return undefined;
    }

    const candidateHash = await this.hashPassword(password, row.password_salt);

    const stored = Buffer.from(row.password_hash, "hex");
    const candidate = Buffer.from(candidateHash, "hex");

    if (
      stored.length !== candidate.length ||
      !timingSafeEqual(stored, candidate)
    ) {
      return undefined;
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
      .run(token, userId, createdAt.toISOString(), expiresAt.toISOString());

    return {
      token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  getSession(token: string): User | undefined {
    const row = this.database
      .prepare(
        `SELECT users.id AS id, users.username AS username, sessions.expires_at AS expires_at
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token = ?`,
      )
      .get(token) as unknown as
      { id: string; username: string; expires_at: string } | undefined;

    if (!row) {
      return undefined;
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      this.deleteSession(token);
      return undefined;
    }

    return { id: row.id, username: row.username };
  }

  deleteSession(token: string): void {
    this.database.prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
  }

  deleteExpiredSessions(): void {
    this.database
      .prepare(`DELETE FROM sessions WHERE expires_at < ?`)
      .run(new Date().toISOString());
  }

  close(): void {
    this.database.close();
  }

  /** Async so a login doesn't block the event loop (and every other
   * user's draft polling) for the duration of the hash. */
  private async hashPassword(password: string, salt: string): Promise<string> {
    const hash = await scryptAsync(password, salt, SCRYPT_KEY_LENGTH);

    return hash.toString("hex");
  }
}
