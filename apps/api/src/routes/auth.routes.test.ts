import Fastify from "fastify";

import cookie from "@fastify/cookie";

import { ZodError } from "zod";

import { describe, expect, it } from "vitest";

import { createAuthRoutes } from "./auth.routes.js";

import {
  AllowlistError,
  DuplicateUsernameError,
  InvalidCredentialsError,
} from "../services/auth.service.js";

function createTestApp(authService: {
  register: (username: string, password: string) => unknown;
  login: (username: string, password: string) => unknown;
  logout: (token: string) => void;
  getUserForSession: (token: string) => unknown;
}) {
  const app = Fastify();

  app.register(cookie);

  app.register(createAuthRoutes(authService as never));

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",
      });
    }

    return reply.status(500).send({
      error: "INTERNAL_SERVER_ERROR",
    });
  });

  return app;
}

describe("auth routes", () => {
  it("registers a user and sets a session cookie", async () => {
    const authService = {
      register: () => ({
        user: { id: "1", username: "testuser" },
        token: "test-token",
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
        throw new AllowlistError("not allowed");
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
        throw new DuplicateUsernameError("taken");
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

  it("logs in with valid credentials and sets a session cookie", async () => {
    const authService = {
      register: () => {
        throw new Error("not used");
      },
      login: () => ({
        user: { id: "1", username: "testuser" },
        token: "test-token",
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

    await app.close();
  });

  it("returns 401 for invalid login credentials", async () => {
    const authService = {
      register: () => {
        throw new Error("not used");
      },
      login: () => {
        throw new InvalidCredentialsError("bad credentials");
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
        token === "valid-token" ? { id: "1", username: "testuser" } : undefined,
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
