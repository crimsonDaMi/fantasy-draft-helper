import { afterEach, describe, expect, it, vi } from "vitest";
import { scryptSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import {
  SESSION_MAX_AGE_MS,
  SESSION_TTL_MS,
  UserRepository,
} from "./user.repository.js";

// Keeps password hashing fast; production uses the OWASP cost.
const FAST_SCRYPT_COST = { log2N: 10, r: 8, p: 1 };
const PASSWORD = "correct horse battery";
const DAY_MS = 24 * 60 * 60 * 1000;

function createTempDatabasePath() {
  const directory = mkdtempSync(join(tmpdir(), "fantasy-draft-helper-auth-"));

  return {
    databasePath: join(directory, "users.db"),
    cleanUp: () => rmSync(directory, { recursive: true, force: true }),
  };
}

function readColumn(databasePath: string, sql: string): unknown[] {
  const database = new DatabaseSync(databasePath);
  const rows = database.prepare(sql).all() as Record<string, unknown>[];
  database.close();
  return rows.map((row) => Object.values(row)[0]);
}

describe("UserRepository", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a user and verifies a matching password", async () => {
    const repository = new UserRepository(":memory:", FAST_SCRYPT_COST);

    const created = await repository.createUser(
      "testuser",
      "correct horse battery",
    );

    const verified = await repository.verifyPassword(
      "testuser",
      "correct horse battery",
    );

    expect(verified).toEqual({
      id: created.id,
      username: "testuser",
    });
  });

  it("rejects an incorrect password", async () => {
    const repository = new UserRepository(":memory:", FAST_SCRYPT_COST);

    await repository.createUser("testuser", "correct horse battery");

    const verified = await repository.verifyPassword(
      "testuser",
      "wrong password",
    );

    expect(verified).toBeUndefined();
  });

  it("rejects a login for a username that does not exist", async () => {
    const repository = new UserRepository(":memory:", FAST_SCRYPT_COST);

    const verified = await repository.verifyPassword("nobody", "anything");

    expect(verified).toBeUndefined();
  });

  it("reports whether a username already exists", async () => {
    const repository = new UserRepository(":memory:", FAST_SCRYPT_COST);

    expect(repository.usernameExists("testuser")).toBe(false);

    await repository.createUser("testuser", "correct horse battery");

    expect(repository.usernameExists("testuser")).toBe(true);
  });

  it("creates a session and resolves it back to the user", async () => {
    const repository = new UserRepository(":memory:", FAST_SCRYPT_COST);

    const user = await repository.createUser(
      "testuser",
      "correct horse battery",
    );

    const session = repository.createSession(user.id);

    const resolved = repository.getSession(session.token);

    expect(resolved).toEqual({
      user: { id: user.id, username: "testuser" },
    });
  });

  it("returns undefined for an unknown session token", async () => {
    const repository = new UserRepository(":memory:", FAST_SCRYPT_COST);

    expect(repository.getSession("not-a-real-token")).toBeUndefined();
  });

  it("deletes a session on logout", async () => {
    const repository = new UserRepository(":memory:", FAST_SCRYPT_COST);

    const user = await repository.createUser(
      "testuser",
      "correct horse battery",
    );

    const session = repository.createSession(user.id);

    repository.deleteSession(session.token);

    expect(repository.getSession(session.token)).toBeUndefined();
  });

  it("rejects a session presented after it expires", async () => {
    const repository = new UserRepository(":memory:", FAST_SCRYPT_COST);

    const user = await repository.createUser(
      "testuser",
      "correct horse battery",
    );

    const session = repository.createSession(user.id);

    vi.useFakeTimers({ now: Date.now() + SESSION_TTL_MS + 1 });

    expect(repository.getSession(session.token)).toBeUndefined();
  });

  it("purges expired sessions on startup and on login", async () => {
    const directory = mkdtempSync(
      join(tmpdir(), "fantasy-draft-helper-sessions-"),
    );
    const databasePath = join(directory, "users.db");
    const countSessions = () => {
      const database = new DatabaseSync(databasePath);
      const row = database
        .prepare(`SELECT COUNT(*) AS count FROM sessions`)
        .get() as { count: number };
      database.close();
      return row.count;
    };

    const repository = new UserRepository(databasePath, FAST_SCRYPT_COST);
    const user = await repository.createUser(
      "testuser",
      "correct horse battery",
    );
    repository.createSession(user.id);
    repository.createSession(user.id);
    expect(countSessions()).toBe(2);

    vi.useFakeTimers({ now: Date.now() + SESSION_TTL_MS + 1 });

    repository.createSession(user.id);
    expect(countSessions()).toBe(1);

    vi.useFakeTimers({ now: Date.now() + SESSION_TTL_MS + 1 });
    repository.close();

    new UserRepository(databasePath, FAST_SCRYPT_COST).close();
    expect(countSessions()).toBe(0);

    rmSync(directory, { recursive: true, force: true });
  });

  it("persists users after the repository is recreated", async () => {
    const directory = mkdtempSync(
      join(tmpdir(), "fantasy-draft-helper-users-"),
    );

    const databasePath = join(directory, "users.db");

    const firstRepository = new UserRepository(databasePath, FAST_SCRYPT_COST);

    await firstRepository.createUser("testuser", "correct horse battery");

    firstRepository.close();

    const recreatedRepository = new UserRepository(
      databasePath,
      FAST_SCRYPT_COST,
    );

    const verified = await recreatedRepository.verifyPassword(
      "testuser",
      "correct horse battery",
    );

    expect(verified?.username).toBe("testuser");

    recreatedRepository.close();
    rmSync(directory, {
      recursive: true,
      force: true,
    });
  });

  it("stores new password hashes with the OWASP scrypt cost", async () => {
    const { databasePath, cleanUp } = createTempDatabasePath();
    const repository = new UserRepository(databasePath);

    await repository.createUser("testuser", PASSWORD);
    repository.close();

    expect(
      readColumn(databasePath, `SELECT password_hash FROM users`)[0],
    ).toMatch(/^scrypt\$17\$8\$1\$[0-9a-f]{128}$/);

    cleanUp();
  });

  describe("legacy password hashes", () => {
    // A hash as stored before the cost was recorded: bare hex at Node's
    // default scrypt cost.
    function seedLegacyHash(databasePath: string, password: string) {
      const salt = "0123456789abcdef0123456789abcdef";
      const hash = scryptSync(password, salt, 64).toString("hex");
      const database = new DatabaseSync(databasePath);
      database
        .prepare(`UPDATE users SET password_salt = ?, password_hash = ?`)
        .run(salt, hash);
      database.close();
      return hash;
    }

    it("verifies them and upgrades them on a successful login", async () => {
      const { databasePath, cleanUp } = createTempDatabasePath();
      const repository = new UserRepository(databasePath, FAST_SCRYPT_COST);
      const user = await repository.createUser("testuser", "placeholder");
      seedLegacyHash(databasePath, PASSWORD);

      expect(await repository.verifyPassword("testuser", PASSWORD)).toEqual(
        user,
      );
      expect(
        readColumn(databasePath, `SELECT password_hash FROM users`)[0],
      ).toMatch(/^scrypt\$10\$8\$1\$/);
      expect(await repository.verifyPassword("testuser", PASSWORD)).toEqual(
        user,
      );

      repository.close();
      cleanUp();
    });

    it("leaves them unchanged after a wrong password", async () => {
      const { databasePath, cleanUp } = createTempDatabasePath();
      const repository = new UserRepository(databasePath, FAST_SCRYPT_COST);
      await repository.createUser("testuser", "placeholder");
      const legacyHash = seedLegacyHash(databasePath, PASSWORD);

      expect(
        await repository.verifyPassword("testuser", "wrong password"),
      ).toBeUndefined();
      expect(
        readColumn(databasePath, `SELECT password_hash FROM users`)[0],
      ).toBe(legacyHash);

      repository.close();
      cleanUp();
    });
  });

  it("never stores the raw session token", async () => {
    const { databasePath, cleanUp } = createTempDatabasePath();
    const repository = new UserRepository(databasePath, FAST_SCRYPT_COST);
    const user = await repository.createUser("testuser", PASSWORD);

    const session = repository.createSession(user.id);

    const stored = readColumn(databasePath, `SELECT token FROM sessions`);
    expect(stored).toHaveLength(1);
    expect(stored[0]).not.toBe(session.token);
    expect(repository.getSession(session.token)?.user).toEqual(user);

    repository.close();
    cleanUp();
  });

  describe("sliding session expiry", () => {
    async function createUserSession() {
      const repository = new UserRepository(":memory:", FAST_SCRYPT_COST);
      const user = await repository.createUser("testuser", PASSWORD);
      const loggedInAt = Date.now();
      const session = repository.createSession(user.id);
      return { repository, session, loggedInAt };
    }

    it("does not renew a session used again within a day", async () => {
      const { repository, session, loggedInAt } = await createUserSession();

      vi.useFakeTimers({ now: loggedInAt + DAY_MS - 1000 });

      expect(repository.getSession(session.token)?.renewedExpiresAt).toBe(
        undefined,
      );
    });

    it("moves the expiry to 30 days from now once a day has passed", async () => {
      const { repository, session, loggedInAt } = await createUserSession();
      const usedAt = loggedInAt + 2 * DAY_MS;

      vi.useFakeTimers({ now: usedAt });

      expect(repository.getSession(session.token)?.renewedExpiresAt).toBe(
        new Date(usedAt + SESSION_TTL_MS).toISOString(),
      );

      vi.useFakeTimers({ now: usedAt + SESSION_TTL_MS - 1000 });

      expect(repository.getSession(session.token)).toBeDefined();
    });

    it("never extends a session past 90 days after login", async () => {
      const { repository, session, loggedInAt } = await createUserSession();

      // Used every 20 days, so it never sits idle for 30.
      let renewedExpiresAt: string | undefined;
      for (let day = 20; day <= 80; day += 20) {
        vi.useFakeTimers({ now: loggedInAt + day * DAY_MS });
        renewedExpiresAt =
          repository.getSession(session.token)?.renewedExpiresAt ??
          renewedExpiresAt;
      }

      // Without the cap, day 60 would renew to day 90 and day 80 to day 110.
      const cappedAt = new Date(renewedExpiresAt ?? 0).getTime();
      expect(
        Math.abs(cappedAt - (loggedInAt + SESSION_MAX_AGE_MS)),
      ).toBeLessThan(1000);

      vi.useFakeTimers({ now: loggedInAt + SESSION_MAX_AGE_MS + 1000 });

      expect(repository.getSession(session.token)).toBeUndefined();
    });
  });
});
