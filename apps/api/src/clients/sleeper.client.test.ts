import { afterEach, describe, expect, it, vi } from "vitest";

import { SleeperClient } from "./sleeper.client.js";
import { HttpError } from "../utils/http-error.js";

function stubFetch(implementation: () => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(implementation));
}

async function getDraftError(): Promise<HttpError> {
  const error = await new SleeperClient()
    .getDraft("draft-1")
    .catch((caught: unknown) => caught);

  expect(error).toBeInstanceOf(HttpError);
  return error as HttpError;
}

describe("SleeperClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the parsed body of a successful response", async () => {
    stubFetch(async () => Response.json({ draft_id: "draft-1" }));

    await expect(new SleeperClient().getDraft("draft-1")).resolves.toEqual({
      draft_id: "draft-1",
    });
  });

  it("passes a 404 through as a permanent answer", async () => {
    stubFetch(async () => new Response(null, { status: 404 }));

    const error = await getDraftError();

    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("SLEEPER_API_ERROR");
  });

  it.each([429, 500, 503])("maps an upstream %i to 502", async (status) => {
    stubFetch(async () => new Response(null, { status }));

    const error = await getDraftError();

    expect(error.statusCode).toBe(502);
    expect(error.code).toBe("SLEEPER_API_ERROR");
  });

  it("maps a network failure to 502 SLEEPER_UNAVAILABLE", async () => {
    const networkError = new TypeError("fetch failed");
    stubFetch(async () => {
      throw networkError;
    });

    const error = await getDraftError();

    expect(error.statusCode).toBe(502);
    expect(error.code).toBe("SLEEPER_UNAVAILABLE");
    expect(error.cause).toBe(networkError);
  });
});
