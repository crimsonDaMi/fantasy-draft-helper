import { useCallback, useEffect, useState } from "react";

import {
  adjustLightness,
  contrastTextColor,
  relativeLuminance,
} from "../utils/color";
import { DEFAULT_THEME_ID, findTheme } from "../themes";

const STORAGE_KEY = "draft-helper-theme";
const UNIVERSAL_TEXT = "#F1F4F0";
const UNIVERSAL_TEXT_MUTED = "#8FA396";
const UNIVERSAL_DANGER = "#E8623D";

export interface ThemeTokens {
  bg: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  danger: string;
}

function deriveTokens(base: string, accent: string): ThemeTokens {
  // Guarantee a dark, scoreboard-style background even for teams whose
  // official primary color is bright (e.g. Chiefs red, Rams blue).
  const bg =
    relativeLuminance(base) > 0.18 ? adjustLightness(base, -0.28) : base;

  return {
    bg,
    surface: adjustLightness(bg, 0.04),
    surfaceRaised: adjustLightness(bg, 0.08),
    border: `${UNIVERSAL_TEXT}14`,
    text: UNIVERSAL_TEXT,
    textMuted: UNIVERSAL_TEXT_MUTED,
    accent,
    accentText: contrastTextColor(accent),
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
  root.setProperty("--color-danger", tokens.danger);
}

function readStoredThemeId(): string {
  try {
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null",
    );
    return typeof stored?.id === "string" ? stored.id : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function useTheme(): [string, (id: string) => void] {
  const [themeId, setThemeIdState] = useState<string>(readStoredThemeId);

  useEffect(() => {
    const theme = findTheme(themeId);
    const tokens = deriveTokens(theme.base, theme.accent);

    applyTokens(tokens);

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ id: themeId, tokens }),
    );
  }, [themeId]);

  const setThemeId = useCallback((id: string) => setThemeIdState(id), []);

  return [themeId, setThemeId];
}
