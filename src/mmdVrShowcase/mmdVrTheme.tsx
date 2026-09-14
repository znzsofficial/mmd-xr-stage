import { createContext, useContext, type ReactNode } from "react";
import type { ThemeSettings } from "../types";
import { resolveThemeMode } from "../system/theme";
import { useThemeSettings } from "../system/useThemeSettings";
import {
  getSystemXrAccentTokens,
  type XrAccentTokens,
  type XrThemeMode,
} from "../xr";

type MmdVrThemeValue = {
  settings: ThemeSettings;
  mode: XrThemeMode;
  accent: XrAccentTokens;
};

const MmdVrThemeContext = createContext<MmdVrThemeValue | null>(null);

export function MmdVrThemeProvider({ children }: { children: ReactNode }) {
  const settings = useThemeSettings();
  const mode = resolveThemeMode(settings.theme);
  const accent = getSystemXrAccentTokens(settings.accentColor, mode);

  return (
    <MmdVrThemeContext.Provider value={{ settings, mode, accent }}>
      {children}
    </MmdVrThemeContext.Provider>
  );
}

export function useMmdVrTheme(): MmdVrThemeValue {
  const value = useContext(MmdVrThemeContext);
  if (!value) throw new Error("useMmdVrTheme must be used within MmdVrThemeProvider");
  return value;
}
