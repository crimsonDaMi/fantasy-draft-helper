import { describe, expect, it } from "vitest";

import {
  isValidTierLabel,
  labelTierToNumeric,
  nextTierLabel,
  normalizeTierValue,
  numericTierToLabel,
} from "./tier.js";

describe("tier conversion", () => {
  it("maps numeric tiers to labels with S as the first tier", () => {
    expect(numericTierToLabel(1)).toBe("S");
    expect(numericTierToLabel(2)).toBe("A");
    expect(numericTierToLabel(3)).toBe("B");
    expect(numericTierToLabel(19)).toBe("R");
    expect(numericTierToLabel(20)).toBe("T");
  });

  it("maps labels back to the matching numeric tier", () => {
    expect(labelTierToNumeric("S")).toBe(1);
    expect(labelTierToNumeric("A")).toBe(2);
    expect(labelTierToNumeric("t")).toBe(20);
  });

  it("rejects out-of-range or non-integer numeric tiers", () => {
    expect(numericTierToLabel(0)).toBeUndefined();
    expect(numericTierToLabel(1.5)).toBeUndefined();
    expect(numericTierToLabel(999)).toBeUndefined();
  });

  it("validates tier labels case-insensitively", () => {
    expect(isValidTierLabel("s")).toBe(true);
    expect(isValidTierLabel("B")).toBe(true);
    expect(isValidTierLabel("Z1")).toBe(false);
  });

  it("normalizes a raw value from either a numeric or letter string", () => {
    expect(normalizeTierValue("1")).toBe("S");
    expect(normalizeTierValue("b")).toBe("B");
    expect(normalizeTierValue(undefined)).toBeUndefined();
    expect(normalizeTierValue("garbage")).toBeUndefined();
  });

  it("advances to the next-worse tier, staying at Z if already there", () => {
    expect(nextTierLabel("S")).toBe("A");
    expect(nextTierLabel("B")).toBe("C");
    expect(nextTierLabel("Z")).toBe("Z");
  });
});
