import { describe, expect, it } from "vitest";

import { parseDraftId } from "./draft-id";

describe("parseDraftId", () => {
  it("keeps a bare draft ID", () => {
    expect(parseDraftId(" 1234567890 ")).toBe("1234567890");
  });

  it.each([
    "https://sleeper.com/draft/nfl/1234567890",
    "https://sleeper.com/draft/nfl/1234567890?ftue=true",
    "sleeper.com/draft/nfl/1234567890/",
  ])("extracts the ID from a draft link: %s", (url) => {
    expect(parseDraftId(url)).toBe("1234567890");
  });

  it("returns other input unchanged, for the API to reject", () => {
    expect(parseDraftId("not-a-draft")).toBe("not-a-draft");
  });
});
