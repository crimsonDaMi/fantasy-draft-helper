import { FastifyReply, FastifyRequest } from "fastify";

import { User } from "../repositories/user.repository.js";
import type { AuthService } from "../services/auth.service.js";
import { HttpError } from "./http-error.js";

export const SESSION_COOKIE = "session";

const isProduction = process.env.NODE_ENV === "production";

/** Sets the session cookie, also when a session is renewed. */
export function setSessionCookie(
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

/** The 401 for a request without a valid session. */
function loginRequired(): HttpError {
  return new HttpError(401, "Login required", "UNAUTHENTICATED");
}

/**
 * The user and token of the request's session cookie, refreshing the
 * cookie when the lookup extended the session. Throws 401 without a valid
 * session.
 */
export function authenticateSession(
  request: FastifyRequest,
  reply: FastifyReply,
  authService: Pick<AuthService, "getUserForSession">,
): { user: User; token: string } {
  const token = request.cookies[SESSION_COOKIE];
  const session = token ? authService.getUserForSession(token) : undefined;

  if (!token || !session) {
    throw loginRequired();
  }

  if (session.renewedExpiresAt) {
    setSessionCookie(reply, token, session.renewedExpiresAt);
  }

  return { user: session.user, token };
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
