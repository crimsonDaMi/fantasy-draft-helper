import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { describe, expect, it } from "vitest";

import { createAuthRoutes } from "./auth.routes.js";
import { errorHandler } from "../utils/error-handler.js";
import {
  ConflictError,
  ForbiddenError,
  TooManyRequestsError,
  UnauthorizedError,
} from "../utils/domain-errors.js";

function createTestApp(authService: {
  register: (username: string, password: string, clientIp: string) => unknown;
  login: (username: string, password: string) => unknown;
  logout: (token: string) => void;
  getUserForSession: (token: string) => unknown;
}) {
  const app = Fastify();

  app.register(cookie);

  app.register(createAuthRoutes(authService as never));

  app.setErrorHandler(errorHandler);

  return app;
}

describe("auth routes", () => {
  it("registers a user and sets a session cookie", async () => {
    const authService = {
      register: () => ({
        user: { id: "1", username: "testuser" },
        token: "test-token",
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
      login: () => {
        throw new Error("not used");
      },
      logout: () => {},
      getUserForSession: () => undefined,
    };

    const app = createTestApp(authService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        username: "testuser",
        password: "correct horse battery",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: { id: "1", username: "testuser" },
    });

    const sessionCookie = response.cookies.find((c) => c.name === "session");

    expect(sessionCookie?.value).toBe("test-token");
    expect(sessionCookie?.httpOnly).toBe(true);

    await app.close();
  });

  it("returns 403 when the username is not allowlisted", async () => {
    const authService = {
      register: () => {
        throw new ForbiddenError("not allowed", "NOT_ALLOWLISTED");
      },
      login: () => {
        throw new Error("not used");
      },
      logout: () => {},
      getUserForSession: () => undefined,
    };

    const app = createTestApp(authService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        username: "stranger",
        password: "correct horse battery",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "NOT_ALLOWLISTED",
      message: "not allowed",
    });

    await app.close();
  });

  it("returns 409 when the username is already taken", async () => {
    const authService = {
      register: () => {
        throw new ConflictError("taken", "USERNAME_TAKEN");
      },
      login: () => {
        throw new Error("not used");
      },
      logout: () => {},
      getUserForSession: () => undefined,
    };

    const app = createTestApp(authService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        username: "testuser",
        password: "correct horse battery",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "USERNAME_TAKEN",
      message: "taken",
    });

    await app.close();
  });

  it.each([
    ["a too-short username", { username: "ab", password: "correct horse" }],
    [
      "a username with spaces inside",
      { username: "test user", password: "correct horse" },
    ],
    [
      "a too-long password",
      { username: "testuser", password: "x".repeat(129) },
    ],
  ])("returns 400 on register for %s", async (_case, payload) => {
    const authService = {
      register: () => {
        throw new Error("not used");
      },
      login: () => {
        throw new Error("not used");
      },
      logout: () => {},
      getUserForSession: () => undefined,
    };

    const app = createTestApp(authService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload,
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "VALIDATION_ERROR" });

    await app.close();
  });

  it("passes the trimmed username and the client IP to register", async () => {
    let registerArgs: unknown[] = [];
    const authService = {
      register: (...args: unknown[]) => {
        registerArgs = args;
        return {
          user: { id: "1", username: "testuser" },
          token: "test-token",
          expiresAt: "2030-01-01T00:00:00.000Z",
        };
      },
      login: () => {
        throw new Error("not used");
      },
      logout: () => {},
      getUserForSession: () => undefined,
    };

    const app = createTestApp(authService);

    await app.inject({
      method: "POST",
      url: "/auth/register",
      remoteAddress: "192.0.2.1",
      payload: { username: " testuser ", password: "correct horse battery" },
    });

    expect(registerArgs).toEqual([
      "testuser",
      "correct horse battery",
      "192.0.2.1",
    ]);

    await app.close();
  });

  it("still logs in usernames that predate the registration limits", async () => {
    let loginUsername: unknown;
    const authService = {
      register: () => {
        throw new Error("not used");
      },
      login: (username: string) => {
        loginUsername = username;
        return {
          user: { id: "1", username },
          token: "test-token",
          expiresAt: "2030-01-01T00:00:00.000Z",
        };
      },
      logout: () => {},
      getUserForSession: () => undefined,
    };

    const app = createTestApp(authService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { username: "a", password: "correct horse battery" },
    });

    expect(response.statusCode).toBe(200);
    expect(loginUsername).toBe("a");

    await app.close();
  });

  it("logs in with valid credentials and sets a session cookie", async () => {
    const authService = {
      register: () => {
        throw new Error("not used");
      },
      login: () => ({
        user: { id: "1", username: "testuser" },
        token: "test-token",
        expiresAt: "2030-01-01T00:00:00.000Z",
      }),
      logout: () => {},
      getUserForSession: () => undefined,
    };

    const app = createTestApp(authService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        username: "testuser",
        password: "correct horse battery",
      },
    });

    expect(response.statusCode).toBe(200);

    const sessionCookie = response.cookies.find((c) => c.name === "session");

    expect(sessionCookie?.value).toBe("test-token");
    expect(sessionCookie?.expires).toEqual(
      new Date("2030-01-01T00:00:00.000Z"),
    );

    await app.close();
  });

  it("returns 429 once a username is locked out", async () => {
    const authService = {
      register: () => {
        throw new Error("not used");
      },
      login: () => {
        throw new TooManyRequestsError("locked out", "TOO_MANY_LOGIN_ATTEMPTS");
      },
      logout: () => {},
      getUserForSession: () => undefined,
    };

    const app = createTestApp(authService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        username: "testuser",
        password: "wrongpassword",
      },
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toEqual({
      error: "TOO_MANY_LOGIN_ATTEMPTS",
      message: "locked out",
    });

    await app.close();
  });

  it("returns 401 for invalid login credentials", async () => {
    const authService = {
      register: () => {
        throw new Error("not used");
      },
      login: () => {
        throw new UnauthorizedError("bad credentials", "INVALID_CREDENTIALS");
      },
      logout: () => {},
      getUserForSession: () => undefined,
    };

    const app = createTestApp(authService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        username: "testuser",
        password: "wrongpassword",
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: "INVALID_CREDENTIALS",
      message: "bad credentials",
    });

    await app.close();
  });

  it("returns the current user for a valid session cookie", async () => {
    const authService = {
      register: () => {
        throw new Error("not used");
      },
      login: () => {
        throw new Error("not used");
      },
      logout: () => {},
      getUserForSession: (token: string) =>
        token === "valid-token"
          ? { user: { id: "1", username: "testuser" } }
          : undefined,
    };

    const app = createTestApp(authService);

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { session: "valid-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      user: { id: "1", username: "testuser" },
    });
    expect(response.cookies).toEqual([]);

    await app.close();
  });

  it("renews the session cookie when the session was extended", async () => {
    const authService = {
      register: () => {
        throw new Error("not used");
      },
      login: () => {
        throw new Error("not used");
      },
      logout: () => {},
      getUserForSession: () => ({
        user: { id: "1", username: "testuser" },
        renewedExpiresAt: "2030-02-01T00:00:00.000Z",
      }),
    };

    const app = createTestApp(authService);

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      cookies: { session: "valid-token" },
    });

    const sessionCookie = response.cookies.find((c) => c.name === "session");

    expect(sessionCookie?.value).toBe("valid-token");
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.expires).toEqual(
      new Date("2030-02-01T00:00:00.000Z"),
    );

    await app.close();
  });

  it("returns 401 for /auth/me with no session cookie", async () => {
    const authService = {
      register: () => {
        throw new Error("not used");
      },
      login: () => {
        throw new Error("not used");
      },
      logout: () => {},
      getUserForSession: () => undefined,
    };

    const app = createTestApp(authService);

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it("clears the session cookie on logout", async () => {
    let loggedOutToken: string | undefined;

    const authService = {
      register: () => {
        throw new Error("not used");
      },
      login: () => {
        throw new Error("not used");
      },
      logout: (token: string) => {
        loggedOutToken = token;
      },
      getUserForSession: () => undefined,
    };

    const app = createTestApp(authService);

    const response = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: { session: "valid-token" },
    });

    expect(response.statusCode).toBe(200);
    expect(loggedOutToken).toBe("valid-token");

    const clearedCookie = response.cookies.find((c) => c.name === "session");

    expect(clearedCookie?.value).toBe("");

    await app.close();
  });
});
