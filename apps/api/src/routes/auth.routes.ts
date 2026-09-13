import {
  FastifyInstance,
} from "fastify";

import { z } from "zod";

import {
  AllowlistError,
  AuthService,
  DuplicateUsernameError,
  InvalidCredentialsError,
} from "../services/auth.service.js";

const credentialsSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
});

const isProduction = process.env.NODE_ENV === "production";

export function createAuthRoutes(
  authService: AuthService,
) {
  return async function authRoutes(
    app: FastifyInstance,
  ) {
    app.post(
      "/auth/register",

      async (request, reply) => {
        const { username, password } =
          credentialsSchema.parse(request.body);

        try {
          const { user, token } = authService.register(
            username,
            password,
          );

          reply.setCookie("session", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: isProduction,
            path: "/",
          });

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
      },
    );

    app.post(
      "/auth/login",

      async (request, reply) => {
        const { username, password } =
          credentialsSchema.parse(request.body);

        try {
          const { user, token } = authService.login(
            username,
            password,
          );

          reply.setCookie("session", token, {
            httpOnly: true,
            sameSite: "lax",
            secure: isProduction,
            path: "/",
          });

          return { user };
        } catch (error) {
          if (error instanceof InvalidCredentialsError) {
            return reply.status(401).send({
              error: "INVALID_CREDENTIALS",
              message: error.message,
            });
          }

          throw error;
        }
      },
    );

    app.post(
      "/auth/logout",

      async (request, reply) => {
        const token = request.cookies.session;

        if (token) {
          authService.logout(token);
        }

        reply.clearCookie("session", { path: "/" });

        return { loggedOut: true };
      },
    );

    app.get(
      "/auth/me",

      async (request, reply) => {
        const token = request.cookies.session;
        const user = token
          ? authService.getUserForSession(token)
          : undefined;

        if (!user) {
          return reply.status(401).send({
            error: "UNAUTHENTICATED",
          });
        }

        return { user };
      },
    );
  };
}