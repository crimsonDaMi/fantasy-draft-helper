import { FastifyRequest } from "fastify";

import { User } from "../repositories/user.repository.js";
import { HttpError } from "./http-error.js";

export const SESSION_COOKIE = "session";

/** The 401 for a request without a valid session. */
export function loginRequired(): HttpError {
  return new HttpError(401, "Login required", "UNAUTHENTICATED");
}

/**
 * The logged-in user for a route behind the auth guard in app.ts. Throws
 * (401) rather than asserting non-null, so a route accidentally left
 * outside the guarded prefixes fails loudly instead of crashing.
 */
export function requireUser(request: FastifyRequest): User {
  if (!request.user) {
    throw loginRequired();
  }

  return request.user;
}
