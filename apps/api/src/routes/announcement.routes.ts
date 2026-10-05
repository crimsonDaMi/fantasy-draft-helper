import { FastifyInstance } from "fastify";

import { readAnnouncement } from "../utils/announcement.js";

/** Public: the banner shows on the login screen too. */
export function createAnnouncementRoutes(announcementPath: string) {
  return async function announcementRoutes(app: FastifyInstance) {
    app.get("/announcement", async (_request, reply) => {
      // Always fresh, so a cleared message disappears on the next check.
      reply.header("Cache-Control", "no-store");

      return { message: await readAnnouncement(announcementPath) };
    });
  };
}
