import Fastify from "fastify";
import cors from "@fastify/cors";
import { ZodError } from "zod";
import fastifyStatic from "@fastify/static";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

import multipart from
  "@fastify/multipart";

import {
  createRankingsRoutes,
} from "./routes/rankings.routes.js";

import {
  createRecommendationsRoutes,
} from "./routes/recommendations.routes.js";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  const dependencies =
    createAppDependencies();

  await app.register(cors, {
    origin: true,
  });

  await app.register(
    multipart,
    {
      limits: {
        fileSize:
          1024 * 1024,
      },
    },
  );

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
      dependencies.draftStateService,
    ),
  );

  await app.register(
    createPlayersRoutes(
      dependencies.playerService,
    ),
  );

  await app.register(
    createRankingsRoutes(
      dependencies.rankingImportService,

      dependencies.rankingStoreService,
    ),
  );

  await app.register(
    createRecommendationsRoutes(
      dependencies.recommendationService,

      dependencies.rankingStoreService,
    ),
  );

  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  await app.register(fastifyStatic, {
    root: path.join(__dirname, "../../web/dist"),
  });

  app.setNotFoundHandler((request, reply) => {
    const apiPrefixes = ["/health", "/drafts", "/players", "/rankings"];
    if (apiPrefixes.some((prefix) => request.raw.url?.startsWith(prefix))) {
      return reply.status(404).send({
        error: "NOT_FOUND",
        message: "Route not found",
      });
    }
    return reply.sendFile("index.html");
  });

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