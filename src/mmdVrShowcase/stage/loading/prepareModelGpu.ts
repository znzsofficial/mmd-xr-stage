import type { Camera, Material, Mesh, Object3D, Scene, Texture, WebGLRenderer } from "three";
import type { PlacementWork } from '../../diagnostics/placementWork';

// Stage the first uploads over several frames. Calling initTexture doesn't draw
// the model or make a second renderer. Keep the XR loading UI rendering.
export async function prepareModelGpu(gl: WebGLRenderer, scene: Scene, camera: Camera, root: Object3D, stale: () => boolean, work?: PlacementWork) {
  const textures = new Set<Texture>();
  const materials = new Set<Material>();
  root.traverse(o => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[]) {
      if (!mat || materials.has(mat)) continue;
      materials.add(mat);
      for (const val of Object.values(mat)) if (val?.isTexture && val.image && !val.isRenderTargetTexture) textures.add(val as Texture);
    }
  });
  for (const texture of textures) {
    if (stale()) return;
    const start = work ? performance.now() : 0;
    gl.initTexture(texture);
    const after = work ? performance.now() : 0;
    if (work) {
      work.textureCount++; work.initTextureCpuMs += after-start;
      work.maxInitTextureCpuMs = Math.max(work.maxInitTextureCpuMs, after-start);
    }
    await new Promise<void>(resolve => setTimeout(resolve, 12));
    if (work) work.yieldWallMs += performance.now()-after;
  }
  if (!stale() && gl.extensions.has("KHR_parallel_shader_compile")) {
    const start = work ? performance.now() : 0;
    await gl.compileAsync(root, gl.xr.isPresenting ? gl.xr.getCamera() : camera, scene);
    if (work) work.compileAsyncWallMs = performance.now()-start;
  }
}
