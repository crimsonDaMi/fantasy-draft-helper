import { FastifyInstance } from "fastify";
import { z } from "zod";

import { AccountService } from "../services/account.service.js";
import { AuthService } from "../services/auth.service.js";
import {
  authenticateSession,
  SESSION_COOKIE,
  setSessionCookie,
} from "../utils/require-user.js";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
});

// For passwords being set (registration, password change). Stricter than
// login, which still has to accept accounts created before these limits
// existed.
const newPasswordSchema = z.string().min(8).max(128);

const registrationSchema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_.-]{3,32}$/),
  password: newPasswordSchema,
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: newPasswordSchema,
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
        request.ip,
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
      const { user } = authenticateSession(request, reply, authService);

      return { user };
    });

    app.post("/auth/password", async (request, reply) => {
      const { user, token } = authenticateSession(request, reply, authService);

      const { currentPassword, newPassword } = changePasswordSchema.parse(
        request.body,
      );

      await authService.changePassword(
        user,
        currentPassword,
        newPassword,
        token,
        request.ip,
      );

      return { changed: true };
    });

    app.delete("/auth/account", async (request, reply) => {
      const { user } = authenticateSession(request, reply, authService);

      const { password } = deleteAccountSchema.parse(request.body);

      await accountService.deleteAccount(user, password, request.ip);

      reply.clearCookie(SESSION_COOKIE, { path: "/" });

      return { deleted: true };
    });
  };
}
