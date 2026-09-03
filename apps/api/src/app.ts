import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";

import {
  createAppDependencies,
} from "./app-dependencies.js";

import {
  createDraftsRoutes,
} from "./routes/drafts.routes.js";

import {
  createPlayersRoutes,
} from "./routes/players.routes.js";

import {
  HttpError,
} from "./utils/http-error.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  const dependencies =
    createAppDependencies();

  await app.register(cors, {
    origin: true,
  });

  app.get(
    "/health",

    async () => {
      return {
        status: "ok",
      };
    },
  );

  await app.register(
    createDraftsRoutes(
      dependencies.draftService,
    ),
  );

  await app.register(
    createPlayersRoutes(
      dependencies.playerService,
    ),
  );

  app.setErrorHandler(
    (error, request, reply) => {
      request.log.error(error);

      if (error instanceof ZodError) {
        return reply.status(400).send({
          error: "VALIDATION_ERROR",

          message:
            "Invalid request parameters",

          details: error.issues,
        });
      }

      if (error instanceof HttpError) {
        return reply
          .status(error.statusCode)
          .send({
            error: "SLEEPER_API_ERROR",

            message: error.message,
          });
      }

      return reply.status(500).send({
        error: "INTERNAL_SERVER_ERROR",

        message:
          "An unexpected error occurred",
      });
    },
  );

  return app;
}