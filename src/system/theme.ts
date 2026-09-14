import type { TranslationKey } from "../languageStore";
import type { ThemeSettings } from "../types";
import { setOwnedLocalStorageItem } from "./persistenceGate";

export const THEME_STORAGE_KEY = "neko-virt-os.theme-settings.v1";

export const WALLPAPERS: Record<ThemeSettings["wallpaperId"], { labelKey: TranslationKey; categoryKey: TranslationKey; source: "built-in" | "unsplash"; url?: string }> = {
  system: { labelKey: "wallpaperSystem", categoryKey: "wallpaperCategoryBuiltIn", source: "built-in" },
  "alpine-lake": { labelKey: "wallpaperAlpineLake", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2400&q=85" },
  "star-field": { labelKey: "wallpaperStarField", categoryKey: "wallpaperCategorySky", source: "unsplash", url: "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=2400&q=85" },
  pacific: { labelKey: "wallpaperPacific", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=2400&q=85" },
  "green-meadow": { labelKey: "wallpaperGreenMeadow", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=2400&q=85" },
  forest: { labelKey: "wallpaperForest", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=2400&q=85" },
  cabin: { labelKey: "wallpaperCabin", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=2400&q=85" },
  "desert-dunes": { labelKey: "wallpaperDesertDunes", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=2400&q=85" },
  "aurora-sky": { labelKey: "wallpaperAuroraSky", categoryKey: "wallpaperCategorySky", source: "unsplash", url: "https://images.unsplash.com/photo-1483347756197-71ef80e95f73?auto=format&fit=crop&w=2400&q=85" },
  "snow-peak": { labelKey: "wallpaperSnowPeak", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=2400&q=85" },
  "city-lights": { labelKey: "wallpaperCityLights", categoryKey: "wallpaperCategoryCity", source: "unsplash", url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=2400&q=85" },
  "sunset-coast": { labelKey: "wallpaperSunsetCoast", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=2400&q=85" },
  "misty-forest": { labelKey: "wallpaperMistyForest", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=2400&q=85" },
  "granite-lake": { labelKey: "wallpaperGraniteLake", categoryKey: "wallpaperCategoryNature", source: "unsplash", url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=2400&q=85" },
  "glass-towers": { labelKey: "wallpaperGlassTowers", categoryKey: "wallpaperCategoryCity", source: "unsplash", url: "https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=2400&q=85" },
  "neon-street": { labelKey: "wallpaperNeonStreet", categoryKey: "wallpaperCategoryCity", source: "unsplash", url: "https://images.unsplash.com/photo-1520034475321-cbe63696469a?auto=format&fit=crop&w=2400&q=85" },
};

export const DEFAULT_THEME_SETTINGS: ThemeSettings = { accentColor: "coral", density: "cozy", theme: "system", wallpaperId: "system", wallpaperLightId: "system", wallpaperDarkId: "system", wallpaperFit: "cover", wallpaperOverlay: "standard" };

export function isWallpaperId(id: unknown): id is ThemeSettings["wallpaperId"] {
  return typeof id === "string" && Object.hasOwn(WALLPAPERS, id);
}

export const ACCENT_COLORS = [
  "blue",
  "cyan",
  "emerald",
  "mint",
  "amber",
  "coral",
  "rose",
  "purple",
  "violet",
  "slate",
] as const satisfies readonly ThemeSettings["accentColor"][];

export const ACCENT_HUES: Record<ThemeSettings["accentColor"], string> = {
  blue: "250",
  cyan: "210",
  emerald: "150",
  mint: "170",
  amber: "75",
  coral: "35",
  rose: "10",
  purple: "300",
  violet: "285",
  slate: "250",
};

export const ACCENT_CHROMA: Record<ThemeSettings["accentColor"], string> = {
  blue: "0.19",
  cyan: "0.17",
  emerald: "0.18",
  mint: "0.16",
  amber: "0.18",
  coral: "0.22",
  rose: "0.21",
  purple: "0.20",
  violet: "0.20",
  slate: "0.08",
};

const WALLPAPER_FITS: ThemeSettings["wallpaperFit"][] = ["cover", "contain", "stretch", "tile"];

export function normalizeThemeSettings(value: Partial<ThemeSettings> & { accentColor?: string } = {}): ThemeSettings {
  const accentColor = (ACCENT_COLORS as readonly string[]).includes(value.accentColor as string)
    ? (value.accentColor as ThemeSettings["accentColor"])
    : DEFAULT_THEME_SETTINGS.accentColor;

  return {
    accentColor,
    density: value.density === "compact" || value.density === "cozy" ? value.density : DEFAULT_THEME_SETTINGS.density,
    theme: value.theme === "system" || value.theme === "dark" || value.theme === "light" ? value.theme : DEFAULT_THEME_SETTINGS.theme,
    wallpaperId: isWallpaperId(value.wallpaperId) ? value.wallpaperId : DEFAULT_THEME_SETTINGS.wallpaperId,
    wallpaperLightId:
      isWallpaperId(value.wallpaperLightId)
        ? value.wallpaperLightId
        : isWallpaperId(value.wallpaperId)
          ? value.wallpaperId
          : DEFAULT_THEME_SETTINGS.wallpaperLightId,
    wallpaperDarkId:
      isWallpaperId(value.wallpaperDarkId)
        ? value.wallpaperDarkId
        : isWallpaperId(value.wallpaperId)
          ? value.wallpaperId
          : DEFAULT_THEME_SETTINGS.wallpaperDarkId,
    wallpaperFit: WALLPAPER_FITS.includes(value.wallpaperFit as ThemeSettings["wallpaperFit"]) ? value.wallpaperFit as ThemeSettings["wallpaperFit"] : DEFAULT_THEME_SETTINGS.wallpaperFit,
    wallpaperOverlay:
      value.wallpaperOverlay === "off" || value.wallpaperOverlay === "soft" || value.wallpaperOverlay === "standard"
        ? value.wallpaperOverlay
        : typeof value.wallpaperOverlay === "boolean"
          ? value.wallpaperOverlay ? "standard" : "off"
          : DEFAULT_THEME_SETTINGS.wallpaperOverlay,
  };
}

export function readThemeSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw ? normalizeThemeSettings(JSON.parse(raw)) : DEFAULT_THEME_SETTINGS;
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
}

const themeListeners = new Set<(theme: ThemeSettings) => void>();

let themeSyncInitialized = false;

function notifyThemeSettings(theme: ThemeSettings) {
  for (const listener of themeListeners) listener(theme);
}

function readThemeSettingsFromStorageValue(value: string | null): ThemeSettings {
  if (!value) return DEFAULT_THEME_SETTINGS;
  try {
    return normalizeThemeSettings(JSON.parse(value));
  } catch {
    return DEFAULT_THEME_SETTINGS;
  }
}

function syncSystemTheme() {
  const theme = readThemeSettings();
  if (theme.theme !== "system") return;
  const wallpaperId = getWallpaperIdForMode(theme);
  if (wallpaperId !== theme.wallpaperId) {
    updateThemeSettings({ wallpaperId });
    return;
  }
  applyThemeSettings(theme);
  notifyThemeSettings(theme);
}

/** Install browser-level listeners shared by the desktop and MMD entry points. */
export function initializeThemeSync() {
  if (themeSyncInitialized || typeof window === "undefined") return;
  themeSyncInitialized = true;

  window.addEventListener("storage", (event) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    const theme = readThemeSettingsFromStorageValue(event.newValue);
    applyThemeSettings(theme);
    notifyThemeSettings(theme);
  });

  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  media?.addEventListener?.("change", syncSystemTheme);
  const syncWallpaperAvailability = () => {
    const theme = readThemeSettings();
    applyThemeSettings(theme);
    notifyThemeSettings(theme);
  };
  window.addEventListener("online", syncWallpaperAvailability);
  window.addEventListener("offline", syncWallpaperAvailability);
}

export function subscribeThemeSettings(listener: (theme: ThemeSettings) => void) {
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

/** Merge patch, persist, and apply to the document. */
export function updateThemeSettings(patch: Partial<ThemeSettings>): ThemeSettings {
  const current = readThemeSettings();
  const next = normalizeThemeSettings({ ...current, ...patch });
  const nextEffectiveTheme = resolveThemeMode(next.theme);

  // Keep wallpaperId as the currently displayed image. A mode change selects
  // that mode's saved slot; selecting either slot can still override it for a
  // live preview without changing the other slot.
  if (
    current.theme !== next.theme &&
    !Object.prototype.hasOwnProperty.call(patch, "wallpaperId")
  ) {
    next.wallpaperId = getWallpaperIdForMode(next, nextEffectiveTheme);
  }
  try {
    setOwnedLocalStorageItem(THEME_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota
  }
  applyThemeSettings(next);
  notifyThemeSettings(next);
  return next;
}

export function applyThemeSettings(theme: ThemeSettings) {
  const root = document.documentElement;
  const effectiveTheme = resolveThemeMode(theme.theme);
  const hue = ACCENT_HUES[theme.accentColor] ?? ACCENT_HUES.blue;
  const chroma = ACCENT_CHROMA[theme.accentColor] ?? ACCENT_CHROMA.blue;
  const primaryL = effectiveTheme === "dark" ? "0.70" : "0.52";
  const primaryStrongL = effectiveTheme === "dark" ? "0.61" : "0.45";
  const accentL = effectiveTheme === "dark" ? "0.80" : "0.68";
  const softBg =
    effectiveTheme === "dark"
      ? `oklch(0.31 ${Math.min(0.105, Number(chroma) * 0.52)} ${hue} / 0.82)`
      : `oklch(0.88 ${Math.min(0.075, Number(chroma) * 0.38)} ${hue} / 0.78)`;

  root.setAttribute("data-accent", theme.accentColor);
  root.setAttribute("data-density", theme.density);
  root.setAttribute("data-theme-mode", theme.theme);
  root.setAttribute("data-theme", effectiveTheme);

  // Keep the low-chroma application surfaces in the selected accent's hue family.
  root.style.setProperty("--os-neutral-color", hue);

  // Inline tokens so accent changes always recompute (attribute-only CSS can look like a no-op).
  root.style.setProperty("--os-primary-color", hue);
  root.style.setProperty("--os-primary-chroma", chroma);
  root.style.setProperty("--os-primary", `oklch(${primaryL} ${chroma} ${hue})`);
  root.style.setProperty("--os-primary-strong", `oklch(${primaryStrongL} ${chroma} ${hue})`);
  root.style.setProperty("--os-primary-soft", softBg);
  root.style.setProperty("--os-accent", `oklch(${accentL} ${chroma} ${hue})`);
  root.style.setProperty("--os-accent-soft", softBg);
  root.style.setProperty("--os-focus", `oklch(${accentL} ${chroma} ${hue})`);
  root.style.setProperty("--os-focus-ring", `oklch(${accentL} ${chroma} ${hue} / 0.28)`);
  root.style.setProperty(
    "--os-selection",
    effectiveTheme === "dark"
      ? `oklch(0.35 ${Math.min(0.14, Number(chroma) * 0.68)} ${hue} / 0.84)`
      : `oklch(0.84 ${Math.min(0.095, Number(chroma) * 0.48)} ${hue} / 0.68)`,
  );
  root.style.setProperty(
    "--os-selection-border",
    effectiveTheme === "dark" ? `oklch(0.70 ${chroma} ${hue})` : `oklch(0.56 ${chroma} ${hue})`,
  );
  root.style.setProperty(
    "--os-wallpaper-glow-a",
    effectiveTheme === "dark"
      ? `oklch(0.3 ${Math.min(0.08, Number(chroma))} ${hue} / 0.24)`
      : `oklch(0.93 ${Math.min(0.04, Number(chroma) * 0.2)} ${hue} / 0.24)`,
  );

  // Drive native chrome (scrollbars, form controls) with the resolved theme.
  root.style.colorScheme = effectiveTheme;
  const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
  if (colorSchemeMeta) colorSchemeMeta.setAttribute("content", effectiveTheme);
  const configuredWallpaperId = theme.wallpaperId;
  const configuredWallpaper = WALLPAPERS[configuredWallpaperId];
  const online = typeof navigator === "undefined" || navigator.onLine;
  const wallpaper = !online && configuredWallpaper.url ? WALLPAPERS.system : configuredWallpaper;
  const nextImage = wallpaper.url ? `url("${wallpaper.url}")` : "none";
  const nextSize = getWallpaperSize(theme.wallpaperFit);
  const nextRepeat = theme.wallpaperFit === "tile" ? "repeat" : "no-repeat";

  // Stage the incoming wallpaper on the cross-fade overlay layer, then commit
  // to the real vars once the fade completes (see .os::before in shell.css).
  root.style.setProperty("--os-wallpaper-next-image", nextImage);
  root.style.setProperty("--os-wallpaper-next-size", nextSize);
  root.style.setProperty("--os-wallpaper-next-repeat", nextRepeat);
  root.setAttribute("data-wallpaper", wallpaper.url ? "online" : "system");

  const firstApply = !root.hasAttribute("data-wallpaper-applied");
  const prevImage = root.style.getPropertyValue("--os-wallpaper-image") || "none";
  const prevSize = root.style.getPropertyValue("--os-wallpaper-size") || "cover";
  const prevRepeat = root.style.getPropertyValue("--os-wallpaper-repeat") || "no-repeat";
  const wallpaperChanged = prevImage !== nextImage || prevSize !== nextSize || prevRepeat !== nextRepeat;

  const commitWallpaper = () => {
    root.style.setProperty("--os-wallpaper-image", nextImage);
    root.style.setProperty("--os-wallpaper-size", nextSize);
    root.style.setProperty("--os-wallpaper-repeat", nextRepeat);
    root.style.setProperty("--os-wallpaper-next-image", "none");
    root.style.setProperty("--os-wallpaper-next-size", "cover");
    root.style.setProperty("--os-wallpaper-next-repeat", "no-repeat");
    root.classList.remove("is-wallpaper-crossfade");
    root.setAttribute("data-wallpaper-fit", theme.wallpaperFit);
    root.setAttribute("data-wallpaper-overlay", theme.wallpaperOverlay);
    root.setAttribute("data-wallpaper-applied", "true");
    wallpaperFadeTimer = undefined;
  };

  if (!firstApply && wallpaperChanged) {
    window.clearTimeout(wallpaperFadeTimer);
    root.classList.add("is-wallpaper-crossfade");
    wallpaperFadeTimer = window.setTimeout(commitWallpaper, 380);
  } else {
    window.clearTimeout(wallpaperFadeTimer);
    commitWallpaper();
  }
}

let wallpaperFadeTimer: number | undefined;

function getWallpaperSize(fit: ThemeSettings["wallpaperFit"]) {
  if (fit === "contain") return "contain";
  if (fit === "stretch") return "100% 100%";
  if (fit === "tile") return "auto";
  return "cover";
}

export function getWallpaperIdForMode(theme: ThemeSettings, mode: "light" | "dark" = resolveThemeMode(theme.theme)) {
  return mode === "dark" ? theme.wallpaperDarkId : theme.wallpaperLightId;
}

export function resolveThemeMode(theme: ThemeSettings["theme"]): "light" | "dark" {
  if (theme !== "system") return theme;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
