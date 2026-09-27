import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { SESSION_TTL_MS, UserRepository } from "./user.repository.js";

describe("UserRepository", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a user and verifies a matching password", async () => {
    const repository = new UserRepository(":memory:");

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
    const repository = new UserRepository(":memory:");

    await repository.createUser("testuser", "correct horse battery");

    const verified = await repository.verifyPassword(
      "testuser",
      "wrong password",
    );

    expect(verified).toBeUndefined();
  });

  it("rejects a login for a username that does not exist", async () => {
    const repository = new UserRepository(":memory:");

    const verified = await repository.verifyPassword("nobody", "anything");

    expect(verified).toBeUndefined();
  });

  it("reports whether a username already exists", async () => {
    const repository = new UserRepository(":memory:");

    expect(repository.usernameExists("testuser")).toBe(false);

    await repository.createUser("testuser", "correct horse battery");

    expect(repository.usernameExists("testuser")).toBe(true);
  });

  it("creates a session and resolves it back to the user", async () => {
    const repository = new UserRepository(":memory:");

    const user = await repository.createUser(
      "testuser",
      "correct horse battery",
    );

    const session = repository.createSession(user.id);

    const resolved = repository.getSession(session.token);

    expect(resolved).toEqual({
      id: user.id,
      username: "testuser",
    });
  });

  it("returns undefined for an unknown session token", async () => {
    const repository = new UserRepository(":memory:");

    expect(repository.getSession("not-a-real-token")).toBeUndefined();
  });

  it("deletes a session on logout", async () => {
    const repository = new UserRepository(":memory:");

    const user = await repository.createUser(
      "testuser",
      "correct horse battery",
    );

    const session = repository.createSession(user.id);

    repository.deleteSession(session.token);

    expect(repository.getSession(session.token)).toBeUndefined();
  });

  it("rejects a session presented after it expires", async () => {
    const repository = new UserRepository(":memory:");

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

    const repository = new UserRepository(databasePath);
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

    new UserRepository(databasePath).close();
    expect(countSessions()).toBe(0);

    rmSync(directory, { recursive: true, force: true });
  });

  it("persists users after the repository is recreated", async () => {
    const directory = mkdtempSync(
      join(tmpdir(), "fantasy-draft-helper-users-"),
    );

    const databasePath = join(directory, "users.db");

    const firstRepository = new UserRepository(databasePath);

    await firstRepository.createUser("testuser", "correct horse battery");

    firstRepository.close();

    const recreatedRepository = new UserRepository(databasePath);

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
});
