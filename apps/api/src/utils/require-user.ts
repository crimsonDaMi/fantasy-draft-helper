import { FastifyRequest } from "fastify";

import { User } from "../repositories/user.repository.js";
import { HttpError } from "./http-error.js";

/**
 * The logged-in user for a route behind the auth guard in app.ts. Throws
 * (401) rather than asserting non-null, so a route accidentally left
 * outside the guarded prefixes fails loudly instead of crashing.
 */
export function requireUser(request: FastifyRequest): User {
  if (!request.user) {
    throw new HttpError(401, "Login required", "UNAUTHENTICATED");
  }

  return request.user;
}
