import { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import {
  AllowlistError,
  AuthService,
  DuplicateUsernameError,
  InvalidCredentialsError,
  TooManyLoginAttemptsError,
} from "../services/auth.service.js";
import { LOGIN_REQUIRED, SESSION_COOKIE } from "../utils/require-user.js";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
});

const isProduction = process.env.NODE_ENV === "production";

function setSessionCookie(
  reply: FastifyReply,
  token: string,
  expiresAt: string,
): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    // Matches the server-side session expiry, so the cookie survives a
    // browser restart for as long as the session itself is valid.
    expires: new Date(expiresAt),
  });
}

export function createAuthRoutes(authService: AuthService) {
  return async function authRoutes(app: FastifyInstance) {
    app.post("/auth/register", async (request, reply) => {
      const { username, password } = credentialsSchema.parse(request.body);

      try {
        const { user, token, expiresAt } = await authService.register(
          username,
          password,
        );

        setSessionCookie(reply, token, expiresAt);

        return { user };
      } catch (error) {
        if (error instanceof AllowlistError) {
          return reply.status(403).send({
            error: "NOT_ALLOWLISTED",
            message: error.message,
          });
        }

        if (error instanceof DuplicateUsernameError) {
          return reply.status(409).send({
            error: "USERNAME_TAKEN",
            message: error.message,
          });
        }

        throw error;
      }
    });

    app.post("/auth/login", async (request, reply) => {
      const { username, password } = credentialsSchema.parse(request.body);

      try {
        const { user, token, expiresAt } = await authService.login(
          username,
          password,
        );

        setSessionCookie(reply, token, expiresAt);

        return { user };
      } catch (error) {
        if (error instanceof InvalidCredentialsError) {
          return reply.status(401).send({
            error: "INVALID_CREDENTIALS",
            message: error.message,
          });
        }

        if (error instanceof TooManyLoginAttemptsError) {
          return reply.status(429).send({
            error: "TOO_MANY_LOGIN_ATTEMPTS",
            message: error.message,
          });
        }

        throw error;
      }
    });

    app.post("/auth/logout", async (request, reply) => {
      const token = request.cookies[SESSION_COOKIE];

      if (token) {
        authService.logout(token);
      }

      reply.clearCookie(SESSION_COOKIE, { path: "/" });

      return { loggedOut: true };
    });

    app.get("/auth/me", async (request, reply) => {
      const token = request.cookies[SESSION_COOKIE];
      const user = token ? authService.getUserForSession(token) : undefined;

      if (!user) {
        return reply.status(401).send(LOGIN_REQUIRED);
      }

      return { user };
    });
  };
}
