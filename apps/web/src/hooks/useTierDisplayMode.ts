import { useCallback, useState } from "react";

import type { TierDisplayMode } from "../components/ranking-editor-logic";
import { readStorage, writeStorage } from "../utils/storage";

const STORAGE_KEY = "draft-helper-tier-display-mode";

/** Letters or numbers for tier labels, shared by the ranking editor and
 * its print view and remembered per browser. Letters by default. */
export function useTierDisplayMode() {
  const [mode, setMode] = useState<TierDisplayMode>(() =>
    readStorage(STORAGE_KEY) === "numeric" ? "numeric" : "alpha",
  );

  const selectMode = useCallback((next: TierDisplayMode) => {
    setMode(next);
    writeStorage(STORAGE_KEY, next);
  }, []);

  return [mode, selectMode] as const;
}
