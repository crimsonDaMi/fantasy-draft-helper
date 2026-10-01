import { describe, expect, it } from "vitest";

import { parseTrustProxy } from "./trust-proxy.js";

describe("parseTrustProxy", () => {
  it("trusts no proxy when unset, empty, or false", () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy("")).toBe(false);
    expect(parseTrustProxy("false")).toBe(false);
  });

  it("reads true", () => {
    expect(parseTrustProxy("true")).toBe(true);
  });

  it("passes trimmed address lists through", () => {
    expect(parseTrustProxy(" loopback,uniquelocal ")).toBe(
      "loopback,uniquelocal",
    );
  });
});
