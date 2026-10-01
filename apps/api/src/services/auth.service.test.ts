import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "./auth.service.js";
import { UserRepository } from "../repositories/user.repository.js";

const PASSWORD = "correct horse battery";
const CLIENT_IP = "192.0.2.1";

async function createServiceWithUser() {
  const service = new AuthService(new UserRepository(":memory:"), ["testuser"]);

  await service.register("testuser", PASSWORD, CLIENT_IP);

  return service;
}

async function failLogins(service: AuthService, times: number) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await expect(
      service.login("testuser", "wrong password"),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  }
}

describe("AuthService login lockout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("locks a username out after five failed logins, even with the right password", async () => {
    const service = await createServiceWithUser();

    await failLogins(service, 5);

    await expect(service.login("testuser", PASSWORD)).rejects.toMatchObject({
      code: "TOO_MANY_LOGIN_ATTEMPTS",
    });
  });

  it("treats usernames case-insensitively when counting failures", async () => {
    const service = await createServiceWithUser();

    await failLogins(service, 5);

    await expect(service.login(" TestUser ", PASSWORD)).rejects.toMatchObject({
      code: "TOO_MANY_LOGIN_ATTEMPTS",
    });
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

describe("AuthService register", () => {
  it("rejects a username that isn't on the allowlist", async () => {
    const service = new AuthService(new UserRepository(":memory:"), [
      "testuser",
    ]);

    await expect(
      service.register("someone", PASSWORD, CLIENT_IP),
    ).rejects.toMatchObject({
      code: "NOT_ALLOWLISTED",
    });
  });

  it("rejects a username that is already registered", async () => {
    const service = await createServiceWithUser();

    await expect(
      service.register(" TestUser ", PASSWORD, CLIENT_IP),
    ).rejects.toMatchObject({ code: "USERNAME_TAKEN" });
  });

  it("accepts any username with open registration", async () => {
    const service = new AuthService(new UserRepository(":memory:"), [], true);

    await expect(
      service.register("someone", PASSWORD, CLIENT_IP),
    ).resolves.toMatchObject({ user: { username: "someone" } });
  });
});

describe("AuthService registration throttle", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function registerUsers(service: AuthService, count: number) {
    for (let index = 0; index < count; index += 1) {
      await service.register(`testuser${index}`, PASSWORD, CLIENT_IP);
    }
  }

  function createOpenService() {
    return new AuthService(new UserRepository(":memory:"), [], true);
  }

  it("rejects a sixth account from the same IP within an hour", async () => {
    const service = createOpenService();

    await registerUsers(service, 5);

    await expect(
      service.register("testuser5", PASSWORD, CLIENT_IP),
    ).rejects.toMatchObject({ code: "TOO_MANY_REGISTRATIONS" });
  });

  it("counts each IP separately", async () => {
    const service = createOpenService();

    await registerUsers(service, 5);

    await expect(
      service.register("testuser5", PASSWORD, "192.0.2.2"),
    ).resolves.toMatchObject({ user: { username: "testuser5" } });
  });

  it("does not count rejected registrations", async () => {
    const service = createOpenService();

    await registerUsers(service, 1);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.register("testuser0", PASSWORD, CLIENT_IP),
      ).rejects.toMatchObject({ code: "USERNAME_TAKEN" });
    }

    await expect(
      service.register("testuser1", PASSWORD, CLIENT_IP),
    ).resolves.toMatchObject({ user: { username: "testuser1" } });
  });

  it("allows new accounts again once the hour has passed", async () => {
    const service = createOpenService();

    await registerUsers(service, 5);

    vi.useFakeTimers({ now: Date.now() + 60 * 60 * 1000 });

    await expect(
      service.register("testuser5", PASSWORD, CLIENT_IP),
    ).resolves.toMatchObject({ user: { username: "testuser5" } });
  });
});
