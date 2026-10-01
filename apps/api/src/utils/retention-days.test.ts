import { describe, expect, it } from "vitest";

import { parseRetentionDays } from "./retention-days.js";

describe("parseRetentionDays", () => {
  it("defaults to 730 days when unset or empty", () => {
    expect(parseRetentionDays(undefined)).toBe(730);
    expect(parseRetentionDays(" ")).toBe(730);
  });

  it("reads whole days, including 0 to turn deletion off", () => {
    expect(parseRetentionDays("365")).toBe(365);
    expect(parseRetentionDays("0")).toBe(0);
  });

  it("rejects anything that isn't a whole number of days", () => {
    for (const value of ["-1", "1.5", "two years"]) {
      expect(() => parseRetentionDays(value)).toThrow(/ACCOUNT_RETENTION_DAYS/);
    }
  });
});
