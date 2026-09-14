import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLocalPrefsStorage } from "./localPrefs";

const KEY = "neko-test.local-prefs";
const LEGACY = "neko-test.local-prefs-legacy";

function installMemoryLocalStorage() {
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, String(v));
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  vi.stubGlobal("localStorage", storage);
  return storage;
}

describe("createLocalPrefsStorage", () => {
  beforeEach(() => {
    installMemoryLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns defaults when empty", () => {
    const storage = createLocalPrefsStorage<{ n: number }>({
      key: KEY,
      defaults: () => ({ n: 1 }),
      normalize: (p) => ({ n: typeof p.n === "number" ? p.n : 1 }),
    });
    expect(storage.read()).toEqual({ n: 1 });
  });

  it("reads legacy key and writes primary", () => {
    localStorage.setItem(LEGACY, JSON.stringify({ n: 7 }));
    const storage = createLocalPrefsStorage<{ n: number }>({
      key: KEY,
      legacyKey: LEGACY,
      defaults: () => ({ n: 0 }),
      normalize: (p) => ({ n: typeof p.n === "number" ? p.n : 0 }),
    });
    expect(storage.read()).toEqual({ n: 7 });
    storage.write({ n: 9 });
    expect(localStorage.getItem(KEY)).toContain("9");
  });

  it("normalizes corrupt JSON to defaults", () => {
    localStorage.setItem(KEY, "{not-json");
    const storage = createLocalPrefsStorage<{ n: number }>({
      key: KEY,
      defaults: () => ({ n: 3 }),
      normalize: (p) => ({ n: typeof p.n === "number" ? p.n : 3 }),
    });
    expect(storage.read()).toEqual({ n: 3 });
  });
});
