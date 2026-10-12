import { useEffect, useState } from "react";

import {
  adjustLightness,
  contrastTextColor,
  LIGHT_TEXT,
  relativeLuminance,
  withContrastOn,
} from "../utils/color";
import { readStoredJson, writeStorage } from "../utils/storage";
import { DEFAULT_THEME_ID, findTheme } from "../themes";

const STORAGE_KEY = "draft-helper-theme";
const UNIVERSAL_TEXT = LIGHT_TEXT;
const UNIVERSAL_TEXT_MUTED = "#8FA396";
const UNIVERSAL_DANGER = "#E8623D";

interface ThemeTokens {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  link: string;
  danger: string;
}

export function deriveTokens(base: string, accent: string): ThemeTokens {
  // Guarantee a dark, scoreboard-style background even for teams whose
  // official primary color is bright (e.g. Chiefs red, Rams blue).
  const bg =
    relativeLuminance(base) > 0.18 ? adjustLightness(base, -0.28) : base;

  const surfaceRaised = adjustLightness(bg, 0.08);

  return {
    bg,
    surface: adjustLightness(bg, 0.04),
    surfaceRaised,
    border: `${UNIVERSAL_TEXT}14`,
    text: UNIVERSAL_TEXT,
    textMuted: UNIVERSAL_TEXT_MUTED,
    accent,
    accentText: contrastTextColor(accent),
    // Many team accents are too dark to read as text on the background;
    // links get a lightened one, readable even on the lightest surface.
    link: withContrastOn(accent, surfaceRaised),
    danger: UNIVERSAL_DANGER,
  };
}

function applyTokens(tokens: ThemeTokens) {
  const root = document.documentElement.style;
  root.setProperty("--color-bg", tokens.bg);
  root.setProperty("--color-surface", tokens.surface);
  root.setProperty("--color-surface-raised", tokens.surfaceRaised);
  root.setProperty("--color-border", tokens.border);
  root.setProperty("--color-text", tokens.text);
  root.setProperty("--color-text-muted", tokens.textMuted);
  root.setProperty("--color-accent", tokens.accent);
  root.setProperty("--color-accent-text", tokens.accentText);
  root.setProperty("--color-link", tokens.link);
  root.setProperty("--color-danger", tokens.danger);
}

function readStoredThemeId(): string {
  const stored = readStoredJson(STORAGE_KEY) as
    { id?: unknown } | null | undefined;

  return typeof stored?.id === "string" ? stored.id : DEFAULT_THEME_ID;
}

export function useTheme(): [string, (id: string) => void] {
  const [themeId, setThemeId] = useState<string>(readStoredThemeId);

  useEffect(() => {
    const theme = findTheme(themeId);
    const tokens = deriveTokens(theme.base, theme.accent);

    applyTokens(tokens);

    writeStorage(STORAGE_KEY, JSON.stringify({ id: themeId, tokens }));
  }, [themeId]);

  return [themeId, setThemeId];
}
