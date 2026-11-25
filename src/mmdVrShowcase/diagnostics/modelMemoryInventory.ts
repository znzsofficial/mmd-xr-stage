import type { BufferGeometry, Material, Mesh, Object3D, Texture } from 'three';

// Only on a new imported root. Bound the breadth as well as the number of
// morph/material references: a single mesh can have thousands of either.
const MAX_NODES = 2048, MAX_REFERENCES = 8192;

export function inspectMountedRoot(root: Object3D) {
  const nodes = [root], geometries = new Set<BufferGeometry>(), backing = new Set<ArrayBufferLike>();
  const materials = new Set<Material>(), maps = new Set<Texture>(), images = new Set<object>();
  let refs = 0, positionBackingBytes = 0, baseMapPixels = 0, truncated = false;
  function addArray(attribute?: {array?: ArrayBufferView}) {
    const buffer = attribute?.array?.buffer;
    if (buffer && !backing.has(buffer)) { backing.add(buffer); positionBackingBytes += buffer.byteLength; }
  }
  function addMaterial(material?: Material & {map?: Texture | null}) {
    if (!material || materials.has(material)) return;
    materials.add(material);
    const map = material.map;
    if (!map || maps.has(map)) return;
    maps.add(map);
    const image = map.image;
    if (!image || typeof image !== 'object' || images.has(image) || Array.isArray(image)) return;
    const size = image as {depth?:number;videoWidth?:number;videoHeight?:number;naturalWidth?:number;naturalHeight?:number;width?:number;height?:number};
    if ((size.depth ?? 1) > 1) return;
    const w = size.videoWidth ?? size.naturalWidth ?? size.width, h = size.videoHeight ?? size.naturalHeight ?? size.height;
    if (typeof w === 'number' && typeof h === 'number' && w > 0 && h > 0 && Number.isSafeInteger(w*h)) { images.add(image); baseMapPixels += w*h; }
  }
  scan: for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i] as Mesh;
    for (const child of node.children) {
      if (nodes.length === MAX_NODES) { truncated = true; break; }
      nodes.push(child);
    }
    const g = node.geometry; // also covers glTF lines and points
    if (!g) continue;
    if (!geometries.has(g)) {
      geometries.add(g); addArray(g.attributes.position);
      for (const attr of g.morphAttributes.position ?? []) {
        if (++refs > MAX_REFERENCES) { truncated = true; break scan; }
        addArray(attr);
      }
    }
    if (Array.isArray(node.material)) {
      for (const mat of node.material) {
        if (++refs > MAX_REFERENCES) { truncated = true; break scan; }
        addMaterial(mat);
      }
    } else addMaterial(node.material);
  }
  return { geometries:geometries.size, positionBackings:backing.size, positionBackingBytes,
    baseMapTextures:maps.size, baseMapImages:images.size, baseMapPixels, truncated };
}
