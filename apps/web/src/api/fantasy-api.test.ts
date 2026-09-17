import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import {
  getRecommendations,
  importRankings,
  login,
  onUnauthorized,
} from "./fantasy-api";

function mockFetchResponse(status: number, body: unknown = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("onUnauthorized notifications", () => {
  let listener: Mock<() => void>;
  let unsubscribe: () => void;

  beforeEach(() => {
    listener = vi.fn<() => void>();
    unsubscribe = onUnauthorized(listener);
  });

  afterEach(() => {
    unsubscribe();
    vi.unstubAllGlobals();
  });

  it("notifies listeners when getRecommendations receives a 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockFetchResponse(401, { message: "Login required" }),
        ),
    );

    await expect(getRecommendations("draft-1", "ranking-1")).rejects.toThrow();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("notifies listeners when importRankings receives a 401", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockFetchResponse(401, { message: "Login required" }),
        ),
    );

    const file = new File(["rank,player\n1,Test"], "rankings.csv", {
      type: "text/csv",
    });

    await expect(importRankings(file)).rejects.toThrow();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify listeners for non-401 errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(mockFetchResponse(404, { message: "Not found" })),
    );

    await expect(getRecommendations("draft-1", "ranking-1")).rejects.toThrow();

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not notify listeners for a successful request", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockFetchResponse(200, { draftId: "draft-1", recommendations: [] }),
        ),
    );

    await getRecommendations("draft-1", "ranking-1");

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not notify listeners when login fails with 401 (wrong credentials, not an expired session)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockFetchResponse(401, {
          message: "Incorrect username or password.",
        }),
      ),
    );

    await expect(login("someone", "wrongpassword")).rejects.toThrow();

    expect(listener).not.toHaveBeenCalled();
  });

  it("stops notifying an unsubscribed listener", async () => {
    unsubscribe();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockFetchResponse(401, {})),
    );

    await expect(getRecommendations("draft-1", "ranking-1")).rejects.toThrow();

    expect(listener).not.toHaveBeenCalled();
  });
});
