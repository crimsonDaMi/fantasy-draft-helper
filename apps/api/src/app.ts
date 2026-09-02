import Fastify from "fastify";
import cors from "@fastify/cors";

export async function buildApp() {
  const app = Fastify({
    logger: true,
  });

  await app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => {
    return {
      status: "ok",
    };
  });

  return app;
}