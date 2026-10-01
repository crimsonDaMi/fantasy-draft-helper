import { FastifyInstance } from "fastify";
import { z } from "zod";

import { AccountService } from "../services/account.service.js";
import { AuthService } from "../services/auth.service.js";
import {
  loginRequired,
  SESSION_COOKIE,
  setSessionCookie,
} from "../utils/require-user.js";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
});

// Stricter than login, which still has to accept accounts created before
// these limits existed.
const registrationSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_.-]{3,32}$/),
  password: z.string().min(8).max(128),
});

const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

export function createAuthRoutes(
  authService: AuthService,
  accountService: AccountService,
) {
  return async function authRoutes(app: FastifyInstance) {
    app.post("/auth/register", async (request, reply) => {
      const { username, password } = registrationSchema.parse(request.body);

      const { user, token, expiresAt } = await authService.register(
        username,
        password,
        request.ip,
      );

      setSessionCookie(reply, token, expiresAt);

      return { user };
    });

    app.post("/auth/login", async (request, reply) => {
      const { username, password } = credentialsSchema.parse(request.body);

      const { user, token, expiresAt } = await authService.login(
        username,
        password,
      );

      setSessionCookie(reply, token, expiresAt);

      return { user };
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
      const session = token ? authService.getUserForSession(token) : undefined;

      if (!token || !session) {
        throw loginRequired();
      }

      if (session.renewedExpiresAt) {
        setSessionCookie(reply, token, session.renewedExpiresAt);
      }

      return { user: session.user };
    });

    app.delete("/auth/account", async (request, reply) => {
      const token = request.cookies[SESSION_COOKIE];
      const session = token ? authService.getUserForSession(token) : undefined;

      if (!session) {
        throw loginRequired();
      }

      const { password } = deleteAccountSchema.parse(request.body);

      await accountService.deleteAccount(session.user, password);

      reply.clearCookie(SESSION_COOKIE, { path: "/" });

      return { deleted: true };
    });
  };
}
