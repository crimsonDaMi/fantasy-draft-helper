import { describe, expect, it } from "vitest";

import { isSpaClientRoute } from "./spa-client-routes.js";

describe("isSpaClientRoute", () => {
  it("matches the ranking editor's client-side route", () => {
    expect(isSpaClientRoute("GET", "/rankings/edit")).toBe(true);
  });

  it("ignores a query string", () => {
    expect(isSpaClientRoute("GET", "/rankings/edit?foo=bar")).toBe(true);
  });

  it("does not match a real ranking id", () => {
    expect(
      isSpaClientRoute("GET", "/rankings/3f6f7f2e-1e8b-4a0b-9c8e-1f2a3b4c5d6e"),
    ).toBe(false);
  });

  it("does not match other rankings API paths", () => {
    expect(isSpaClientRoute("GET", "/rankings/status")).toBe(false);
    expect(isSpaClientRoute("GET", "/rankings")).toBe(false);
  });

  it("only matches GET requests", () => {
    expect(isSpaClientRoute("POST", "/rankings/edit")).toBe(false);
  });

  it("handles a missing url", () => {
    expect(isSpaClientRoute("GET", undefined)).toBe(false);
  });
});
