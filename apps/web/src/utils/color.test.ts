import { describe, expect, it } from "vitest";

import { contrastRatio, relativeLuminance, withContrastOn } from "./color";

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for a color on itself", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21);
    expect(contrastRatio("#C60C30", "#C60C30")).toBe(1);
  });
});

describe("withContrastOn", () => {
  const navy = "#0A2A5E";

  it("keeps a color that already has enough contrast", () => {
    expect(withContrastOn("#FFB612", "#203731")).toBe("#FFB612");
  });

  it("lightens a dark accent until it's readable, keeping it reddish", () => {
    const link = withContrastOn("#C60C30", navy);

    expect(contrastRatio(link, navy)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(link, navy)).toBeLessThan(5);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(link.slice(i, i + 2), 16));
    expect(r).toBeGreaterThan(g!);
    expect(r).toBeGreaterThan(b!);
  });

  it("falls back to white when no lightness reaches the ratio", () => {
    const lightBackground = "#5A8A8F";

    expect(relativeLuminance(lightBackground)).toBeGreaterThan(0.18);
    expect(withContrastOn("#123456", lightBackground)).toMatch(/^#f{6}$/i);
  });
});
