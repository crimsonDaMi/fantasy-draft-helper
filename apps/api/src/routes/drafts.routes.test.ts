import Fastify from "fastify";
import { describe, expect, it } from "vitest";

import { createDraftsRoutes } from "./drafts.routes.js";
import { errorHandler } from "../utils/error-handler.js";

describe("drafts routes", () => {
  it("returns a draft with the ADP format matching its league", async () => {
    const app = Fastify();

    app.setErrorHandler(errorHandler);
    app.register(
      createDraftsRoutes({
        getDraft: async () => ({
          id: "draft-1",
          status: "PRE_DRAFT",
          rosterSlots: { QB: 1, SUPER_FLEX: 1 },
          scoringType: "dynasty_ppr",
        }),
      } as never),
    );

    const response = await app.inject({
      method: "GET",
      url: "/drafts/draft-1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      id: "draft-1",
      adpFormat: { column: "Dynasty SF ADP", label: "Dynasty SF" },
    });

    await app.close();
  });
});
