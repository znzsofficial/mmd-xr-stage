// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_THEME_SETTINGS,
  ACCENT_HUES,
  THEME_STORAGE_KEY,
  WALLPAPERS,
  applyThemeSettings,
  getWallpaperIdForMode,
  initializeThemeSync,
  normalizeThemeSettings,
  subscribeThemeSettings,
  updateThemeSettings,
} from "./theme";

function wallpaperImage(id: keyof typeof WALLPAPERS) {
  const url = WALLPAPERS[id].url;
  return url ? `url("${url}")` : "none";
}

function createStorage() {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => values.delete(key),
    setItem: (key: string, value: string) => values.set(key, value),
  } satisfies Pick<Storage, "clear" | "getItem" | "removeItem" | "setItem">;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("localStorage", createStorage());
  document.documentElement.removeAttribute("data-wallpaper-applied");
  document.documentElement.className = "";
  document.documentElement.style.cssText = "";
  document.head.innerHTML = '<meta name="color-scheme" content="light">';
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("theme settings", () => {
  it("keeps the selected slot immediately visible even when it is not active", async () => {
    const initial = normalizeThemeSettings({
      theme: "dark",
      wallpaperId: "alpine-lake",
      wallpaperLightId: "forest",
      wallpaperDarkId: "alpine-lake",
    });
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(initial));
    applyThemeSettings(initial);

    const next = updateThemeSettings({ wallpaperId: "forest", wallpaperLightId: "forest" });
    await vi.advanceTimersByTimeAsync(380);

    expect(next.wallpaperId).toBe("forest");
    expect(next.wallpaperLightId).toBe("forest");
    expect(document.documentElement.style.getPropertyValue("--os-wallpaper-image")).toBe(wallpaperImage("forest"));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toContain('"wallpaperId":"forest"');
  });

  it("uses the saved wallpaper for the new mode when the color mode changes", async () => {
    const initial = normalizeThemeSettings({
      theme: "light",
      wallpaperId: "forest",
      wallpaperLightId: "forest",
      wallpaperDarkId: "star-field",
    });
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(initial));
    applyThemeSettings(initial);

    const next = updateThemeSettings({ theme: "dark" });
    await vi.advanceTimersByTimeAsync(380);

    expect(next.wallpaperId).toBe("star-field");
    expect(document.documentElement.style.getPropertyValue("--os-wallpaper-image")).toBe(wallpaperImage("star-field"));
  });

  it("allows a system mode change to select the matching saved slot", () => {
    const settings = normalizeThemeSettings({
      theme: "system",
      wallpaperId: "forest",
      wallpaperLightId: "forest",
      wallpaperDarkId: "star-field",
    });

    expect(getWallpaperIdForMode(settings, "light")).toBe("forest");
    expect(getWallpaperIdForMode(settings, "dark")).toBe("star-field");
  });

  it("preserves the current wallpaper when unrelated settings change", () => {
    const initial = normalizeThemeSettings({ wallpaperId: "forest", wallpaperLightId: "forest" });
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(initial));
    applyThemeSettings(initial);

    const next = updateThemeSettings({ accentColor: "coral" });

    expect(next.wallpaperId).toBe("forest");
    expect(next.wallpaperLightId).toBe("forest");
    expect(DEFAULT_THEME_SETTINGS.wallpaperId).toBe("system");
  });

  it("derives the quiet surface hue from the selected accent", () => {
    const initial = normalizeThemeSettings({ accentColor: "coral" });
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(initial));
    applyThemeSettings(initial);

    expect(document.documentElement.style.getPropertyValue("--os-neutral-color")).toBe(ACCENT_HUES.coral);

    const next = updateThemeSettings({ accentColor: "mint" });

    expect(next.accentColor).toBe("mint");
    expect(document.documentElement.style.getPropertyValue("--os-neutral-color")).toBe(ACCENT_HUES.mint);
    expect(document.documentElement.style.getPropertyValue("--os-primary-color")).toBe(ACCENT_HUES.mint);
  });

  it("updates the neutral hue for dark mode as well", () => {
    const initial = normalizeThemeSettings({ theme: "dark", accentColor: "blue" });
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(initial));

    applyThemeSettings(initial);
    const next = updateThemeSettings({ accentColor: "purple" });

    expect(next.accentColor).toBe("purple");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.getPropertyValue("--os-neutral-color")).toBe(ACCENT_HUES.purple);
  });

  it("propagates theme changes received from another document", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeThemeSettings(listener);
    initializeThemeSync();
    const incoming = normalizeThemeSettings({ accentColor: "mint", theme: "dark" });

    window.dispatchEvent(new StorageEvent("storage", {
      key: THEME_STORAGE_KEY,
      newValue: JSON.stringify(incoming),
    }));

    expect(listener).toHaveBeenLastCalledWith(incoming);
    expect(document.documentElement.dataset.accent).toBe("mint");
    expect(document.documentElement.dataset.theme).toBe("dark");
    unsubscribe();
  });
});
