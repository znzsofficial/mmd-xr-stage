import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPersistencePaused,
  pausePersistence,
  resumePersistence,
  runPersistedWrite,
  setOwnedLocalStorageItem,
} from "./persistenceGate";

afterEach(() => {
  resumePersistence();
  vi.unstubAllGlobals();
});

describe("persistence gate", () => {
  it("waits for active writes and blocks new writes", async () => {
    let finish!: () => void;
    const active = runPersistedWrite(() => new Promise<void>((resolve) => { finish = resolve; }));
    let paused = false;
    const pause = pausePersistence().then(() => { paused = true; });

    await Promise.resolve();
    expect(paused).toBe(false);
    expect(isPersistencePaused()).toBe(true);
    finish();
    await active;
    await pause;

    await expect(runPersistedWrite(async () => undefined)).rejects.toThrow("persistence-paused");
  });

  it("prevents mounted stores from recreating local data", async () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      setItem: (key: string, value: string) => data.set(key, value),
      getItem: (key: string) => data.get(key) ?? null,
      removeItem: (key: string) => data.delete(key),
    });
    await pausePersistence();
    expect(setOwnedLocalStorageItem("neko-virt-os.test", "old-state")).toBe(false);
    expect(data.has("neko-virt-os.test")).toBe(false);
  });
});
