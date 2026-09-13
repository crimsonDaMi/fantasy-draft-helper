import { useCallback, useEffect, useState } from "react";

export type Theme = "forest" | "steel";

const STORAGE_KEY = "draft-helper-theme";
const DEFAULT_THEME: Theme = "forest";

function isTheme(value: string | null): value is Theme {
  return value === "forest" || value === "steel";
}

function readStoredTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isTheme(stored) ? stored : DEFAULT_THEME;
}

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  return [theme, setTheme];
}