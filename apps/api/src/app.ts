import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { ZodError } from "zod";
import fastifyStatic from "@fastify/static";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AppDependencies, createAppDependencies } from "./app-dependencies.js";

import { createAuthRoutes } from "./routes/auth.routes.js";

import { createDraftsRoutes } from "./routes/drafts.routes.js";

import { createPlayersRoutes } from "./routes/players.routes.js";

import { HttpError } from "./utils/http-error.js";

import multipart from "@fastify/multipart";

import { createRankingEditorRoutes } from "./routes/ranking-editor.routes.js";

import { createRankingsRoutes } from "./routes/rankings.routes.js";

import { createRecommendationsRoutes } from "./routes/recommendations.routes.js";

import { isSpaClientRoute } from "./utils/spa-client-routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { version: APP_VERSION } = JSON.parse(
  readFileSync(path.join(__dirname, "../../../package.json"), "utf-8"),
) as { version: string };

export async function buildApp(
  dependencies: AppDependencies = createAppDependencies(),
) {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
    // @fastify/cors only allows GET/HEAD/POST by default; the ranking
    // editor's PATCH/DELETE calls need these for cross-origin dev.
    methods: ["GET", "HEAD", "POST", "PATCH", "DELETE"],
  });

  await app.register(cookie);

  await app.register(multipart, {
    limits: {
      fileSize: 1024 * 1024,
    },
  });

  app.get(
    "/health",

    async () => {
      return {
        status: "ok",
        version: APP_VERSION,
      };
    },
  );

  await app.register(createAuthRoutes(dependencies.authService));

  app.decorateRequest("user", undefined);

  const PROTECTED_PREFIXES = ["/rankings", "/drafts", "/players"];

  app.addHook("onRequest", async (request, reply) => {
    if (isSpaClientRoute(request.method, request.raw.url)) {
      return reply.sendFile("index.html");
    }

    const isProtected = PROTECTED_PREFIXES.some((prefix) =>
      request.raw.url?.startsWith(prefix),
    );

    if (!isProtected) {
      return;
    }

    const token = request.cookies.session;
    const user = token
      ? dependencies.authService.getUserForSession(token)
      : undefined;

    if (!user) {
      return reply.status(401).send({
        error: "UNAUTHENTICATED",
        message: "Login required",
      });
    }

    request.user = user;
  });

  await app.register(
    createDraftsRoutes(
      dependencies.draftService,
      dependencies.draftStateService,
    ),
  );

  await app.register(createPlayersRoutes(dependencies.playerService));

  await app.register(
    createRankingsRoutes(
      dependencies.rankingImportService,

      dependencies.rankingStoreService,
    ),
  );

  await app.register(
    createRankingEditorRoutes(dependencies.rankingEditorService),
  );

  await app.register(
    createRecommendationsRoutes(
      dependencies.recommendationService,

      dependencies.rankingStoreService,
    ),
  );

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

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: "VALIDATION_ERROR",

        message: "Invalid request parameters",

        details: error.issues,
      });
    }

    if (error instanceof HttpError) {
      return reply.status(error.statusCode).send({
        error: "SLEEPER_API_ERROR",

        message: error.message,
      });
    }

    return reply.status(500).send({
      error: "INTERNAL_SERVER_ERROR",

      message: "An unexpected error occurred",
    });
  });

  return app;
}
