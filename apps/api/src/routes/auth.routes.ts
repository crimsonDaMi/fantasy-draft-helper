import { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { AuthService } from "../services/auth.service.js";
import { loginRequired, SESSION_COOKIE } from "../utils/require-user.js";

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

      const { user, token, expiresAt } = await authService.register(
        username,
        password,
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

    app.get("/auth/me", async (request) => {
      const token = request.cookies[SESSION_COOKIE];
      const user = token ? authService.getUserForSession(token) : undefined;

      if (!user) {
        throw loginRequired();
      }

      return { user };
    });
  };
}
