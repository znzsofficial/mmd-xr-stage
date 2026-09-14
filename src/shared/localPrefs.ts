import { setOwnedLocalStorageItem } from "../system/persistenceGate";

/**
 * Tiny localStorage JSON prefs helper (legacy key + normalize).
 * No React; safe for stores and pure modules.
 */

export type LocalPrefsOptions<T> = {
  key: string;
  legacyKey?: string;
  defaults: () => T;
  normalize: (raw: Partial<T>) => T;
};

export type LocalPrefsStorage<T> = {
  read: () => T;
  write: (value: T) => void;
};

export function createLocalPrefsStorage<T extends object>(
  opts: LocalPrefsOptions<T>,
): LocalPrefsStorage<T> {
  function read(): T {
    try {
      const raw =
        localStorage.getItem(opts.key) ??
        (opts.legacyKey ? localStorage.getItem(opts.legacyKey) : null);
      if (!raw) return opts.defaults();
      return opts.normalize(JSON.parse(raw) as Partial<T>);
    } catch {
      return opts.defaults();
    }
  }

  function write(value: T) {
    try {
      setOwnedLocalStorageItem(opts.key, JSON.stringify(value));
    } catch {
      // ignore quota / private mode
    }
  }

  return { read, write };
}
