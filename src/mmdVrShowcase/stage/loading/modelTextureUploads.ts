import type { ThreeMmdModel } from '@yohawing/three-mmd-loader';
import type { MeshToonMaterial, Texture } from 'three';
import type { PlacementWork } from '../../diagnostics/placementWork';

type Upload = {
  textures: Texture[];
  next: number;
  stale: () => boolean;
  work?: PlacementWork;
  queuedAt: number;
  resolve: () => void;
  reject: (reason: unknown) => void;
};

/** One queue per XR renderer attachment. The tracked frame does the uploads;
 * a waiting placement owns the model and can still retire it without drawing. */
export function createModelTextureUploads(initTexture: (texture: Texture) => void) {
  const pending: Upload[] = [];
  let disposed = false;
  return {
    prepare(model: ThreeMmdModel, stale: () => boolean, work?: PlacementWork): Promise<void> {
      if (disposed) return Promise.reject(new DOMException('Stage changed', 'AbortError'));
      if (stale()) return Promise.resolve();
      const textures = new Set<Texture>();
      for (const material of [model.mesh.material].flat()) {
        // These are the three references retained by the loader's TSL surface.
        const { map, gradientMap } = material as Partial<MeshToonMaterial>;
        for (const texture of [map, gradientMap, material.userData.mmdSphereTexture]) {
          if (texture?.isTexture && texture.image) textures.add(texture);
        }
      }
      if (!textures.size) return Promise.resolve();
      return new Promise((resolve, reject) => {
        pending.push({ textures: [...textures], next: 0, stale, work, queuedAt: work ? performance.now() : 0, resolve, reject });
      });
    },

    advance() {
      while (pending[0]?.stale()) pending.shift()!.resolve();
      const upload = pending[0];
      if (!upload) return;
      const { textures, work } = upload;
      try {
        const at = work ? performance.now() : 0;
        initTexture(textures[upload.next++]);
        if (work) {
          work.yieldWallMs += at - upload.queuedAt;
          upload.queuedAt = performance.now();
          const elapsed = upload.queuedAt - at;
          work.textureCount++;
          work.initTextureCpuMs += elapsed;
          work.maxInitTextureCpuMs = Math.max(work.maxInitTextureCpuMs, elapsed);
        }
        if (upload.next === textures.length) pending.shift()!.resolve();
      } catch (error) {
        pending.shift()!.reject(error);
      }
    },

    dispose() {
      disposed = true;
      // The owning load releases its model; the queue never disposes textures.
      for (const upload of pending.splice(0)) upload.reject(new DOMException('Stage changed', 'AbortError'));
    },
  };
}
