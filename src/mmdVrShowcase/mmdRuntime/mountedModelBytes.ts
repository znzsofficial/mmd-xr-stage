/** Only in-flight placements and mounted actors can own these source bytes.
 * No textures, parsed model, evaluator or Bullet world in this pool. Reserve
 * before starting I/O so concurrent rooms/instances cannot overbook it. */
export const MODEL_BYTES_BUDGET = 32 * 1024 * 1024;

export interface ModelByteLease {
  read(): Promise<Uint8Array>;
  release(): void;
}

export function createMountedModelBytePool(limit = MODEL_BYTES_BUDGET) {
  type Slot = { owners: number; read?: Promise<Uint8Array> };
  const live = new Map<File, Slot>();
  let reserved = 0;
  return {
    get reservedBytes() { return reserved; },
    acquire(file: File): ModelByteLease | undefined {
      let slot = live.get(file);
      if (!slot) {
        if (file.size === 0 || file.size > limit - reserved) return undefined;
        slot = { owners: 0 };
        live.set(file, slot);
        reserved += file.size;
      }
      slot.owners++;
      let held: Slot | undefined = slot;
      return {
        async read() {
          if (!held) throw new DOMException('Actor retired', 'AbortError');
          const current = held;
          // A rejection is not a cache entry; a released in-flight read never
          // installs anything into a later reservation for the same File.
          return current.read ??= file.arrayBuffer().then(buffer => {
            if (buffer.byteLength !== file.size) throw Error('Incomplete model source');
            return new Uint8Array(buffer);
          }).catch(error => { current.read = undefined; throw error; });
        },
        release() {
          if (!held) return;
          if (--held.owners === 0) {
            live.delete(file);
            reserved -= file.size;
            held.read = undefined;
          }
          held = undefined;
        },
      };
    },
  };
}

// Shared cap even if a retired room has an asynchronous placement winding down.
export const mountedModelBytePool = createMountedModelBytePool();
