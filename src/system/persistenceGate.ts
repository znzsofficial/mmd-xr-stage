let paused = false;
let activeWrites = 0;
const drainWaiters = new Set<() => void>();

function notifyDrained() {
  if (activeWrites !== 0) return;
  for (const resolve of drainWaiters) resolve();
  drainWaiters.clear();
}

export function isPersistencePaused() {
  return paused;
}

export async function pausePersistence() {
  paused = true;
  if (activeWrites === 0) return;
  await new Promise<void>((resolve) => drainWaiters.add(resolve));
}

export function resumePersistence() {
  paused = false;
}

export async function runPersistedWrite<T>(write: () => Promise<T>): Promise<T> {
  if (paused) throw new Error("persistence-paused");
  activeWrites += 1;
  try {
    return await write();
  } finally {
    activeWrites -= 1;
    notifyDrained();
  }
}

export function setOwnedLocalStorageItem(key: string, value: string) {
  if (paused) return false;
  localStorage.setItem(key, value);
  return true;
}

export function removeOwnedLocalStorageItem(key: string) {
  if (paused) return false;
  localStorage.removeItem(key);
  return true;
}
