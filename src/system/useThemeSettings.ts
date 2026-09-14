import { useEffect, useState } from "react";
import type { ThemeSettings } from "../types";
import {
  initializeThemeSync,
  readThemeSettings,
  subscribeThemeSettings,
} from "./theme";

/** Reactive view of the shared system theme for secondary entry points. */
export function useThemeSettings(): ThemeSettings {
  const [theme, setTheme] = useState<ThemeSettings>(readThemeSettings);

  useEffect(() => {
    initializeThemeSync();
    return subscribeThemeSettings((next) => setTheme(next));
  }, []);

  return theme;
}
