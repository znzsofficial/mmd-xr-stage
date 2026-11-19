/** Exact loader alpha samples. null means the full source was read and opaque;
 * undefined (missing/unreadable) must retry. Never keep decoded images or actors. */
type Entry = { file: WeakRef<File>; width: number; height: number; tile: Uint8Array | null; ready: boolean };

// A .png name can contain SVG or APNG. Cache only confirmed non-animated
// PNGs; acTL must precede IDAT. Long/unknown headers use the original scan.
async function isStaticPng(file: File) {
  const v = new DataView(await file.slice(0,4096).arrayBuffer());
  if (v.byteLength < 33 || v.getUint32(0)!==0x89504e47 || v.getUint32(4)!==0x0d0a1a0a ||
    v.getUint32(8)!==13 || v.getUint32(12)!==0x49484452) return false;
  for (let at=33; at+8<=v.byteLength; at+=12+v.getUint32(at)) {
    const type=v.getUint32(at+4);
    if (type===0x6163544c) return false; // acTL
    if (type===0x49444154) return true;  // IDAT
  }
  return false;
}

export function createRoomAlphaTiles() {
  const entries: Entry[] = [];
  let generation = 0;
  const find = (file: File) => entries.findIndex(e => e.file.deref() === file);
  return {
    forLoad(stale: () => boolean) {
      const current = generation;
      return {
        get(file: File, width: number, height: number) {
          if (current !== generation || stale()) return undefined;
          const index = find(file), entry = entries[index];
          if (!entry?.ready || entry.width !== width || entry.height !== height) return undefined;
          entries.push(...entries.splice(index, 1));
          return entry.tile;
        },
        set(file: File, width: number, height: number, tile: Uint8Array | null) {
          if (current !== generation || stale()) return;
          const index = find(file);
          if (index >= 0) entries.splice(index, 1);
          if (entries.length >= 8) entries.shift(); // at most 8 x 512 x 512 bytes
          const entry={file: new WeakRef(file), width, height, tile, ready:false};
          entries.push(entry);
          // The first load doesn't wait for another file read. A late verdict
          // can only update this specific entry, never reinsert an evicted tile.
          return isStaticPng(file).then(ok=>{
            if(ok && current===generation && !stale()) entry.ready=true;
            else {const i=entries.indexOf(entry); if(i>=0)entries.splice(i,1);}
          },()=>{const i=entries.indexOf(entry); if(i>=0)entries.splice(i,1);});
        },
      };
    },
    clear() { generation++; entries.length = 0; },
  };
}
export type RoomAlphaTiles = ReturnType<typeof createRoomAlphaTiles>;
