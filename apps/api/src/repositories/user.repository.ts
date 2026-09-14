import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";

import {
  DatabaseSync,
} from "node:sqlite";

import {
  openDatabase,
} from "./database.js";

const SCRYPT_KEY_LENGTH = 64;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface User {
  id: string;
  username: string;
}

export class UserRepository {
  private readonly database: DatabaseSync;

  constructor(
    databasePath?: string,
  ) {
    this.database = openDatabase(
      databasePath,
    );

    this.database.exec(`
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
    `);
  }

  createUser(
    username: string,
    password: string,
  ): User {
    const id = randomUUID();
    const salt = randomBytes(16).toString("hex");
    const hash = this.hashPassword(password, salt);
    const createdAt = new Date().toISOString();

    this.database
      .prepare(
        `INSERT INTO users (id, username, password_salt, password_hash, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(id, username, salt, hash, createdAt);

    return { id, username };
  }

  usernameExists(
    username: string,
  ): boolean {
    const row = this.database
      .prepare(
        `SELECT 1 AS found
         FROM users
         WHERE username = ?
         LIMIT 1`,
      )
      .get(username) as unknown as
      | { found: number }
      | undefined;

    return row !== undefined;
  }

  verifyPassword(
    username: string,
    password: string,
  ): User | undefined {
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
      return undefined;
    }

    const candidateHash = this.hashPassword(
      password,
      row.password_salt,
    );

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

  createSession(
    userId: string,
  ): { token: string; expiresAt: string } {
    const token = randomBytes(32).toString("hex");
    const createdAt = new Date();
    const expiresAt = new Date(
      createdAt.getTime() + SESSION_TTL_MS,
    );

    this.database
      .prepare(
        `INSERT INTO sessions (token, user_id, created_at, expires_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(
        token,
        userId,
        createdAt.toISOString(),
        expiresAt.toISOString(),
      );

    return {
      token,
      expiresAt: expiresAt.toISOString(),
    };
  }

  getSession(
    token: string,
  ): User | undefined {
    const row = this.database
      .prepare(
        `SELECT users.id AS id, users.username AS username, sessions.expires_at AS expires_at
         FROM sessions
         JOIN users ON users.id = sessions.user_id
         WHERE sessions.token = ?`,
      )
      .get(token) as unknown as
      | { id: string; username: string; expires_at: string }
      | undefined;

    if (!row) {
      return undefined;
    }

    if (new Date(row.expires_at).getTime() < Date.now()) {
      this.deleteSession(token);
      return undefined;
    }

    return { id: row.id, username: row.username };
  }

  deleteSession(
    token: string,
  ): void {
    this.database
      .prepare(
        `DELETE FROM sessions WHERE token = ?`,
      )
      .run(token);
  }

  close(): void {
    this.database.close();
  }

  private hashPassword(
    password: string,
    salt: string,
  ): string {
    return scryptSync(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
    ).toString("hex");
  }
}