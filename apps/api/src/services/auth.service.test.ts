import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "./auth.service.js";
import { UserRepository } from "../repositories/user.repository.js";

// Keeps password hashing fast; production uses the OWASP cost.
const FAST_SCRYPT_COST = { log2N: 10, r: 8, p: 1 };

const PASSWORD = "correct horse battery";
const CLIENT_IP = "192.0.2.1";

async function createServiceWithUser() {
  const service = new AuthService(
    new UserRepository(":memory:", FAST_SCRYPT_COST),
    ["testuser"],
  );

  await service.register("testuser", PASSWORD, CLIENT_IP);

  return service;
}

const OTHER_IP = "198.51.100.7";

async function failLogins(
  service: AuthService,
  times: number,
  clientIp = CLIENT_IP,
) {
  for (let attempt = 0; attempt < times; attempt += 1) {
    await expect(
      service.login("testuser", "wrong password", clientIp),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  }
}

/** Five failures from each of `ipCount` addresses (each one locked out). */
async function failLoginsFromManyIps(service: AuthService, ipCount: number) {
  for (let ip = 0; ip < ipCount; ip += 1) {
    await failLogins(service, 5, `203.0.113.${ip}`);
  }
}

describe("AuthService login lockout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("locks a username out on one IP after five failed logins, even with the right password", async () => {
    const service = await createServiceWithUser();

    await failLogins(service, 5);

    await expect(
      service.login("testuser", PASSWORD, CLIENT_IP),
    ).rejects.toMatchObject({ code: "TOO_MANY_LOGIN_ATTEMPTS" });
  });

  it("still lets the same username log in from another IP", async () => {
    const service = await createServiceWithUser();

    await failLogins(service, 5);

    await expect(
      service.login("testuser", PASSWORD, OTHER_IP),
    ).resolves.toMatchObject({ user: { username: "testuser" } });
  });

  it("treats usernames case-insensitively when counting failures", async () => {
    const service = await createServiceWithUser();

    await failLogins(service, 5);

    await expect(
      service.login(" TestUser ", PASSWORD, CLIENT_IP),
    ).rejects.toMatchObject({ code: "TOO_MANY_LOGIN_ATTEMPTS" });
  });

  it("locks the account everywhere after 50 failures across many IPs", async () => {
    const service = await createServiceWithUser();

    await failLoginsFromManyIps(service, 9);
    await failLogins(service, 4, OTHER_IP);

    // 49 failures: a fresh IP still gets in.
    await expect(
      service.login("testuser", PASSWORD, "192.0.2.200"),
    ).resolves.toMatchObject({ user: { username: "testuser" } });

    await failLogins(service, 1, OTHER_IP);

    await expect(
      service.login("testuser", PASSWORD, "192.0.2.201"),
    ).rejects.toMatchObject({ code: "TOO_MANY_LOGIN_ATTEMPTS" });
  });

  it("lifts the lockout once the 15-minute window has passed", async () => {
    const service = await createServiceWithUser();

    await failLogins(service, 5);
    await failLoginsFromManyIps(service, 9);

    vi.useFakeTimers({ now: Date.now() + 15 * 60 * 1000 });

    await expect(
      service.login("testuser", PASSWORD, CLIENT_IP),
    ).resolves.toMatchObject({ user: { username: "testuser" } });
  });

  it("resets the failure count for that IP after a successful login", async () => {
    const service = await createServiceWithUser();

    await failLogins(service, 4);
    await service.login("testuser", PASSWORD, CLIENT_IP);
    await failLogins(service, 4);

    await expect(
      service.login("testuser", PASSWORD, CLIENT_IP),
    ).resolves.toMatchObject({ user: { username: "testuser" } });
  });

  it("keeps the account-wide count after a successful login", async () => {
    const service = await createServiceWithUser();

    await failLoginsFromManyIps(service, 9);
    await service.login("testuser", PASSWORD, OTHER_IP);
    await failLogins(service, 5, OTHER_IP);

    await expect(
      service.login("testuser", PASSWORD, "192.0.2.200"),
    ).rejects.toMatchObject({ code: "TOO_MANY_LOGIN_ATTEMPTS" });
  });

  it("returns the session expiry alongside the token", async () => {
    const service = await createServiceWithUser();

    const session = await service.login("testuser", PASSWORD, CLIENT_IP);

    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("AuthService register", () => {
  it("rejects a username that isn't on the allowlist", async () => {
    const service = new AuthService(
      new UserRepository(":memory:", FAST_SCRYPT_COST),
      ["testuser"],
    );

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
    const service = new AuthService(
      new UserRepository(":memory:", FAST_SCRYPT_COST),
      [],
      true,
    );

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
    return new AuthService(
      new UserRepository(":memory:", FAST_SCRYPT_COST),
      [],
      true,
    );
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

describe("AuthService changePassword", () => {
  const NEW_PASSWORD = "new correct horse";

  async function createServiceWithSessions() {
    const service = new AuthService(
      new UserRepository(":memory:", FAST_SCRYPT_COST),
      ["testuser"],
    );
    const current = await service.register("testuser", PASSWORD, CLIENT_IP);
    const other = await service.login("testuser", PASSWORD, OTHER_IP);

    return { service, current, other };
  }

  it("changes the password, keeping only the current session", async () => {
    const { service, current, other } = await createServiceWithSessions();

    await service.changePassword(
      current.user,
      PASSWORD,
      NEW_PASSWORD,
      current.token,
      CLIENT_IP,
    );

    await expect(
      service.login("testuser", PASSWORD, CLIENT_IP),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
    });
    await expect(
      service.login("testuser", NEW_PASSWORD, CLIENT_IP),
    ).resolves.toMatchObject({ user: { username: "testuser" } });
    expect(service.getUserForSession(current.token)?.user).toEqual(
      current.user,
    );
    expect(service.getUserForSession(other.token)).toBeUndefined();
  });

  it("rejects a wrong current password with 403 and changes nothing", async () => {
    const { service, current, other } = await createServiceWithSessions();

    await expect(
      service.changePassword(
        current.user,
        "wrong password",
        NEW_PASSWORD,
        current.token,
        CLIENT_IP,
      ),
    ).rejects.toMatchObject({ code: "INVALID_PASSWORD" });

    await expect(
      service.login("testuser", PASSWORD, CLIENT_IP),
    ).resolves.toMatchObject({
      user: { username: "testuser" },
    });
    expect(service.getUserForSession(other.token)?.user).toEqual(current.user);
  });

  it("counts wrong current passwords towards the login lockout", async () => {
    const { service, current } = await createServiceWithSessions();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.changePassword(
          current.user,
          "wrong password",
          NEW_PASSWORD,
          current.token,
          CLIENT_IP,
        ),
      ).rejects.toMatchObject({ code: "INVALID_PASSWORD" });
    }

    await expect(
      service.changePassword(
        current.user,
        PASSWORD,
        NEW_PASSWORD,
        current.token,
        CLIENT_IP,
      ),
    ).rejects.toMatchObject({ code: "TOO_MANY_LOGIN_ATTEMPTS" });
    await expect(
      service.login("testuser", PASSWORD, CLIENT_IP),
    ).rejects.toMatchObject({
      code: "TOO_MANY_LOGIN_ATTEMPTS",
    });
  });
});
