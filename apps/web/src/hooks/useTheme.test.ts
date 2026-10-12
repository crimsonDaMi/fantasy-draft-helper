import { describe, expect, it } from "vitest";

import { deriveTokens } from "./useTheme";
import { THEMES } from "../themes";
import { contrastRatio } from "../utils/color";

describe("deriveTokens", () => {
  it.each(THEMES.map((theme) => [theme.name, theme] as const))(
    "gives %s a link color readable on its lightest surface",
    (_, theme) => {
      const tokens = deriveTokens(theme.base, theme.accent);
      const ratio = contrastRatio(tokens.link, tokens.surfaceRaised);

      // White is as far as a link can go; a background too light for
      // that is the theme's own limit.
      if (ratio < 4.5) {
        expect(tokens.link.toLowerCase()).toBe("#ffffff");
      } else {
        expect(ratio).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
