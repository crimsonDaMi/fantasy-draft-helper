import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
} from "./domain-errors.js";
import { errorHandler } from "./error-handler.js";

async function respondWith(error: Error) {
  const app = Fastify();

  app.setErrorHandler(errorHandler);

  app.get("/fail", async () => {
    throw error;
  });

  const response = await app.inject({ method: "GET", url: "/fail" });

  await app.close();

  return response;
}

describe("errorHandler", () => {
  it("maps a NotFoundError to a 404 with its code", async () => {
    const response = await respondWith(
      new NotFoundError("Player was not found", "PLAYER_NOT_FOUND"),
    );

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "PLAYER_NOT_FOUND",
      message: "Player was not found",
    });
  });

  it("maps a ConflictError to a 409 with its code", async () => {
    const response = await respondWith(
      new ConflictError("Cannot add more than 26 tiers", "TIER_LIMIT_REACHED"),
    );

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: "TIER_LIMIT_REACHED",
      message: "Cannot add more than 26 tiers",
    });
  });

  it.each([
    [new UnauthorizedError("Wrong password", "INVALID_CREDENTIALS"), 401],
    [new ForbiddenError("Not allowed", "NOT_ALLOWLISTED"), 403],
    [new TooManyRequestsError("Slow down", "TOO_MANY_LOGIN_ATTEMPTS"), 429],
  ])("maps %o to its status with its code", async (error, status) => {
    const response = await respondWith(error);

    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual({
      error: error.code,
      message: error.message,
    });
  });

  it("hides the message of an unexpected error behind a 500", async () => {
    const response = await respondWith(new Error("boom"));

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
    });
  });
});
