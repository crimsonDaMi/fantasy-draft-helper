import "fastify";

import { User } from "../repositories/user.repository.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
  }
}
