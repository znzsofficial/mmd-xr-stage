// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { initializeBrowserColorScheme } from "./theme";

const key = "neko-virt-os.theme-settings.v1";

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("style");
});

it("honors just the legacy browser mode across tabs without writing any preferences", () => {
  const record = { theme: "dark", accentColor: "purple", wallpaperId: "forest", density: "compact" };
  const values = new Map([[key, JSON.stringify(record)], ["neko-virt-os.language.v1", "en"]]);
  // A write, remove or clear must not be attempted, even on the shared record.
  const setItem = vi.fn(), removeItem = vi.fn(), clear = vi.fn();
  vi.stubGlobal("localStorage", { getItem: (k: string) => values.get(k) ?? null, setItem, removeItem, clear });
  const stop = initializeBrowserColorScheme();
  try {
    const root = document.documentElement;
    expect(root.style.colorScheme).toBe("dark");
    const original = root.cloneNode(false);
    const publish = () => window.dispatchEvent(new StorageEvent("storage", { key, newValue: values.get(key) }));
    values.set(key, JSON.stringify({ ...record, accentColor: "amber" }));
    publish();
    expect(root.cloneNode(false).isEqualNode(original)).toBe(true);
    values.set(key, JSON.stringify({ ...record, theme: "light" }));
    publish();
    expect(root.style.colorScheme).toBe("light");
    for (const next of ['{"theme":"system"}', "{broken", "null"]) {
      values.set(key, next);
      publish();
      expect(root.style.colorScheme).toBe("light dark");
    }
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  } finally { stop(); }
});
