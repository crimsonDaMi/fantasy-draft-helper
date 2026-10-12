import { describe, expect, it } from "vitest";

import { deriveTokens } from "./useTheme";
import { THEMES } from "../themes";
import { contrastRatio, relativeLuminance } from "../utils/color";

describe("deriveTokens", () => {
  it.each(THEMES.map((theme) => [theme.name, theme] as const))(
    "gives %s a link color readable on its lightest surface",
    (_, theme) => {
      const tokens = deriveTokens(theme.base, theme.accent);
      expect(
        contrastRatio(tokens.link, tokens.surfaceRaised),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each(THEMES.map((theme) => [theme.name, theme] as const))(
    "gives %s readable body and muted text on every surface",
    (_, theme) => {
      const tokens = deriveTokens(theme.base, theme.accent);

      for (const background of [
        tokens.bg,
        tokens.surface,
        tokens.surfaceRaised,
      ]) {
        expect(contrastRatio(tokens.text, background)).toBeGreaterThanOrEqual(
          7,
        );
        expect(
          contrastRatio(tokens.textMuted, background),
        ).toBeGreaterThanOrEqual(4.5);
      }

      // Still a dark, scoreboard-style background...
      expect(relativeLuminance(tokens.bg)).toBeLessThanOrEqual(0.18);
      // ...and muted text still clearly dimmer than body text.
      expect(contrastRatio(tokens.text, tokens.textMuted)).toBeGreaterThan(1.5);
    },
  );
});
