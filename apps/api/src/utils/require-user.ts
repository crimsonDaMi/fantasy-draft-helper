import { FastifyRequest } from "fastify";

import { User } from "../repositories/user.repository.js";
import { HttpError } from "./http-error.js";

export const SESSION_COOKIE = "session";

/** The 401 body for a missing or expired session. The auth guard and
 * `/auth/me` send it directly rather than throwing, so routine logged-out
 * requests don't go through the error handler's error log. */
export const LOGIN_REQUIRED = {
  error: "UNAUTHENTICATED",
  message: "Login required",
} as const;

/**
 * The logged-in user for a route behind the auth guard in app.ts. Throws
 * (401) rather than asserting non-null, so a route accidentally left
 * outside the guarded prefixes fails loudly instead of crashing.
 */
export function requireUser(request: FastifyRequest): User {
  if (!request.user) {
    throw new HttpError(401, LOGIN_REQUIRED.message, LOGIN_REQUIRED.error);
  }

  return request.user;
}
