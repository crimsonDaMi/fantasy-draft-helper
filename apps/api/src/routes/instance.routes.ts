import { FastifyInstance } from "fastify";

import { InstanceInfo } from "../utils/instance-info.js";

/** Public: the privacy notice needs it before anyone logs in. */
export function createInstanceRoutes(instanceInfo: InstanceInfo) {
  return async function instanceRoutes(app: FastifyInstance) {
    app.get("/instance", async () => instanceInfo);
  };
}
