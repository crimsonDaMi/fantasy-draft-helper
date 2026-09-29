import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import multipart from "@fastify/multipart";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AppDependencies, createAppDependencies } from "./app-dependencies.js";
import { createAuthRoutes } from "./routes/auth.routes.js";
import { createDraftsRoutes } from "./routes/drafts.routes.js";
import { createPlayersRoutes } from "./routes/players.routes.js";
import { errorHandler } from "./utils/error-handler.js";
import { createRankingEditorRoutes } from "./routes/ranking-editor.routes.js";
import { createRankingsRoutes } from "./routes/rankings.routes.js";
import { createRecommendationsRoutes } from "./routes/recommendations.routes.js";
import { LOGIN_REQUIRED, SESSION_COOKIE } from "./utils/require-user.js";
import { isSpaClientRoute } from "./utils/spa-client-routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { version: APP_VERSION } = JSON.parse(
  readFileSync(path.join(__dirname, "../../../package.json"), "utf-8"),
) as { version: string };

// Largest accepted ranking CSV upload.
const MAX_CSV_UPLOAD_BYTES = 1024 * 1024;

// Route namespaces that require a logged-in session.
const PROTECTED_PREFIXES = ["/rankings", "/drafts", "/players"];

// Every API namespace. Unknown paths under these get a JSON 404; anything
// else falls through to the SPA shell for client-side routing.
const API_PREFIXES = ["/health", "/auth", ...PROTECTED_PREFIXES];

export async function buildApp(injectedDependencies?: AppDependencies) {
  const app = Fastify({
    logger: true,
  });

  // Created after the Fastify instance so services can log through its
  // pino logger rather than the console.
  const dependencies = injectedDependencies ?? createAppDependencies(app.log);

  // Must be set before any route plugin is registered: each `await
  // app.register(...)` loads immediately and captures the error handler
  // in effect at that moment, so a handler set afterwards never reaches
  // the routes.
  app.setErrorHandler(errorHandler);

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
      fileSize: MAX_CSV_UPLOAD_BYTES,
    },
  });

  app.get("/health", async () => {
    return {
      status: "ok",
      version: APP_VERSION,
    };
  });

  await app.register(createAuthRoutes(dependencies.authService));

  app.decorateRequest("user", undefined);

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

    const token = request.cookies[SESSION_COOKIE];
    const user = token
      ? dependencies.authService.getUserForSession(token)
      : undefined;

    if (!user) {
      return reply.status(401).send(LOGIN_REQUIRED);
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
    if (API_PREFIXES.some((prefix) => request.raw.url?.startsWith(prefix))) {
      return reply.status(404).send({
        error: "NOT_FOUND",
        message: "Route not found",
      });
    }
    return reply.sendFile("index.html");
  });

  return app;
}
