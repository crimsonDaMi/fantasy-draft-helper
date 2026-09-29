import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readStorage,
  readStoredJson,
  removeStorage,
  writeStorage,
} from "./storage";

describe("storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("round-trips values", () => {
    writeStorage("test-key", "value");
    expect(readStorage("test-key")).toBe("value");

    removeStorage("test-key");
    expect(readStorage("test-key")).toBeUndefined();
  });

  it("returns undefined for missing or unparsable JSON", () => {
    expect(readStoredJson("test-key")).toBeUndefined();

    window.localStorage.setItem("test-key", "{not json");
    expect(readStoredJson("test-key")).toBeUndefined();

    window.localStorage.setItem("test-key", '{"id":"x"}');
    expect(readStoredJson("test-key")).toEqual({ id: "x" });
  });

  it("never throws when storage is unavailable", () => {
    const blocked = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked);
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(blocked);

    expect(readStorage("test-key")).toBeUndefined();
    expect(readStoredJson("test-key")).toBeUndefined();
    expect(() => writeStorage("test-key", "value")).not.toThrow();
    expect(() => removeStorage("test-key")).not.toThrow();
  });
});
