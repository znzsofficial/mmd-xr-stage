import * as THREE from 'three';

/** Only for an independently decoded glTF group. THREE.Texture.dispose()
 * releases renderer storage, not ImageBitmapLoader's decoded bitmap. */
export function disposeStageObject(group: THREE.Group, ownsBitmaps: boolean) {
  const resources = new Set<THREE.BufferGeometry | THREE.Texture | THREE.Material | THREE.Skeleton | THREE.InstancedMesh>();
  const bitmaps = new Set<ImageBitmap>();
  group.traverse(child => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points)) return;
    if (child instanceof THREE.SkinnedMesh && child.skeleton) resources.add(child.skeleton);
    if (child instanceof THREE.InstancedMesh) resources.add(child);
    resources.add(child.geometry);
    for (const material of Array.isArray(child.material) ? child.material : [child.material]) {
      if (!material || resources.has(material)) continue;
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture && !resources.has(value)) {
        resources.add(value);
        // The product uses a separate uncached loader per import. If global
        // caching is enabled, image lifetime belongs to that cache instead.
        if (ownsBitmaps && typeof ImageBitmap !== 'undefined' && value.image instanceof ImageBitmap) bitmaps.add(value.image);
      }
    }
  });
  for (const resource of resources) resource.dispose();
  for (const bitmap of bitmaps) bitmap.close();
}
