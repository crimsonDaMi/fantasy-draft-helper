import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AuthService,
  InvalidCredentialsError,
  TooManyLoginAttemptsError,
} from "./auth.service.js";
import { UserRepository } from "../repositories/user.repository.js";

const PASSWORD = "correct horse battery";

async function createServiceWithUser() {
  const service = new AuthService(new UserRepository(":memory:"), ["testuser"]);

  await service.register("testuser", PASSWORD);

  return service;
}

async function failLogins(service: AuthService, times: number) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await expect(service.login("testuser", "wrong password")).rejects.toThrow(
      InvalidCredentialsError,
    );
  }
}

describe("AuthService login lockout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("locks a username out after five failed logins, even with the right password", async () => {
    const service = await createServiceWithUser();

    await failLogins(service, 5);

    await expect(service.login("testuser", PASSWORD)).rejects.toThrow(
      TooManyLoginAttemptsError,
    );
  });

  it("treats usernames case-insensitively when counting failures", async () => {
    const service = await createServiceWithUser();

    await failLogins(service, 5);

    await expect(service.login(" TestUser ", PASSWORD)).rejects.toThrow(
      TooManyLoginAttemptsError,
    );
  });

  it("lifts the lockout once the 15-minute window has passed", async () => {
    const service = await createServiceWithUser();

    await failLogins(service, 5);

    vi.useFakeTimers({ now: Date.now() + 15 * 60 * 1000 });

    await expect(service.login("testuser", PASSWORD)).resolves.toMatchObject({
      user: { username: "testuser" },
    });
  });

  it("resets the failure count after a successful login", async () => {
    const service = await createServiceWithUser();

    await failLogins(service, 4);
    await service.login("testuser", PASSWORD);
    await failLogins(service, 4);

    await expect(service.login("testuser", PASSWORD)).resolves.toMatchObject({
      user: { username: "testuser" },
    });
  });

  it("returns the session expiry alongside the token", async () => {
    const service = await createServiceWithUser();

    const session = await service.login("testuser", PASSWORD);

    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});
