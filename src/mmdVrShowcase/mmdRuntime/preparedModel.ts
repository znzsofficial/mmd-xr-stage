import { ThreeMmdLoader } from "@yohawing/three-mmd-loader";
import { createLocalTextureResolver } from "./localTextureResolver";
import { disposeLoadedModelObject } from "./mmdRuntimeEntry";

// One prepared, non-physics character. Ownership moves exactly once to the XR
// runtime. Changing companions (including a repaired binding) invalidates it.
export function createPreparedSlot<T>(load: (file: File, companions: readonly File[]) => Promise<T>, dispose: (value:T)=>void) {
  type Entry = { file:File; files:readonly File[]; promise:Promise<T | null>; value:T | null; claimed:boolean };
  let current: Entry | null = null;
  let previous: Promise<unknown> = Promise.resolve();
  function clear() {
    const old = current; current = null;
    if (old?.value != null) { dispose(old.value); old.value = null; }
  }
  return {
    clear,
    warm(file: File, companions: readonly File[]) {
      clear();
      const entry: Entry = { file, files:[...companions], promise:Promise.resolve(null), value:null, claimed:false };
      current = entry;
      entry.promise = previous.then(async () => {
        if (entry !== current && !entry.claimed) return null;
        const model = await load(file, companions);
        if (entry.claimed) return model;
        if (current !== entry) { dispose(model); return null; }
        entry.value = model; return model;
      }).catch(() => { if (current === entry) current = null; return null; });
      // Never retain a resolved model through the scheduling tail.
      previous = entry.promise.then(() => undefined);
      return entry.promise.then(v => v !== null);
    },
    take(file: File, companions: readonly File[]) {
      const entry = current;
      if (!entry || entry.file !== file || entry.files.length !== companions.length || !entry.files.every((f,i)=>f===companions[i])) return null;
      current = null; entry.claimed = true; entry.value = null;
      return entry.promise;
    },
  };
}

export const preparedModel = createPreparedSlot((file, companions) => new ThreeMmdLoader({
  textureResolver: createLocalTextureResolver(file,companions), runtime:{physics:"none"},
}).loadModel(file), disposeLoadedModelObject);
