import { describe, expect, it } from "vitest";

import { mkdtempSync, rmSync } from "node:fs";

import { tmpdir } from "node:os";

import { join } from "node:path";

import { UserRepository } from "./user.repository.js";

describe("UserRepository", () => {
  it("creates a user and verifies a matching password", () => {
    const repository = new UserRepository(":memory:");

    const created = repository.createUser("testuser", "correct horse battery");

    const verified = repository.verifyPassword(
      "testuser",
      "correct horse battery",
    );

    expect(verified).toEqual({
      id: created.id,
      username: "testuser",
    });
  });

  it("rejects an incorrect password", () => {
    const repository = new UserRepository(":memory:");

    repository.createUser("testuser", "correct horse battery");

    const verified = repository.verifyPassword("testuser", "wrong password");

    expect(verified).toBeUndefined();
  });

  it("rejects a login for a username that does not exist", () => {
    const repository = new UserRepository(":memory:");

    const verified = repository.verifyPassword("nobody", "anything");

    expect(verified).toBeUndefined();
  });

  it("reports whether a username already exists", () => {
    const repository = new UserRepository(":memory:");

    expect(repository.usernameExists("testuser")).toBe(false);

    repository.createUser("testuser", "correct horse battery");

    expect(repository.usernameExists("testuser")).toBe(true);
  });

  it("creates a session and resolves it back to the user", () => {
    const repository = new UserRepository(":memory:");

    const user = repository.createUser("testuser", "correct horse battery");

    const session = repository.createSession(user.id);

    const resolved = repository.getSession(session.token);

    expect(resolved).toEqual({
      id: user.id,
      username: "testuser",
    });
  });

  it("returns undefined for an unknown session token", () => {
    const repository = new UserRepository(":memory:");

    expect(repository.getSession("not-a-real-token")).toBeUndefined();
  });

  it("deletes a session on logout", () => {
    const repository = new UserRepository(":memory:");

    const user = repository.createUser("testuser", "correct horse battery");

    const session = repository.createSession(user.id);

    repository.deleteSession(session.token);

    expect(repository.getSession(session.token)).toBeUndefined();
  });

  it("persists users after the repository is recreated", () => {
    const directory = mkdtempSync(
      join(tmpdir(), "fantasy-draft-helper-users-"),
    );

    const databasePath = join(directory, "users.db");

    const firstRepository = new UserRepository(databasePath);

    firstRepository.createUser("testuser", "correct horse battery");

    firstRepository.close();

    const recreatedRepository = new UserRepository(databasePath);

    const verified = recreatedRepository.verifyPassword(
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
