import type { Camera, Material, Mesh, Object3D, Scene, Texture, WebGLRenderer } from "three";

// Stage the first uploads over several frames. Calling initTexture doesn't draw
// the model or make a second renderer. Keep the XR loading UI rendering.
export async function prepareModelGpu(gl: WebGLRenderer, scene: Scene, camera: Camera, root: Object3D, stale: () => boolean) {
  const textures = new Set<Texture>();
  root.traverse(o => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    for (const mat of (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as Material[]) {
      if (!mat) continue;
      for (const val of Object.values(mat)) if (val?.isTexture && val.image && !val.isRenderTargetTexture) textures.add(val as Texture);
    }
  });
  for (const texture of textures) {
    if (stale()) return;
    gl.initTexture(texture);
    await new Promise<void>(resolve => setTimeout(resolve, 12));
  }
  if (!stale() && gl.extensions.has("KHR_parallel_shader_compile")) {
    await gl.compileAsync(root, gl.xr.isPresenting ? gl.xr.getCamera() : camera, scene);
  }
}
