import * as THREE from "three";

type PmremCache = {
  source: THREE.Texture;
  renderTarget: THREE.WebGLRenderTarget;
  generator: THREE.PMREMGenerator;
};

const cacheByRenderer = new WeakMap<THREE.WebGLRenderer, PmremCache>();

/** Build / reuse a CubeUV PMREM from an equirectangular sky texture. */
export function getPmremEnvMap(
  renderer: THREE.WebGLRenderer,
  source: THREE.Texture | null,
): THREE.Texture | null {
  if (!source) {
    disposePmremEnvMap(renderer);
    return null;
  }

  const prev = cacheByRenderer.get(renderer);
  if (prev && prev.source === source) return prev.renderTarget.texture;

  disposePmremEnvMap(renderer);

  const generator = new THREE.PMREMGenerator(renderer);
  generator.compileEquirectangularShader();
  const renderTarget = generator.fromEquirectangular(source);
  cacheByRenderer.set(renderer, { source, renderTarget, generator });
  return renderTarget.texture;
}

export function disposePmremEnvMap(renderer: THREE.WebGLRenderer) {
  const prev = cacheByRenderer.get(renderer);
  if (!prev) return;
  prev.renderTarget.dispose();
  prev.generator.dispose();
  cacheByRenderer.delete(renderer);
}

/** CubeUV atlas defines expected by three's textureCubeUV helpers. */
export function cubeUvDefines(envMap: THREE.Texture | null): {
  maxMip: number;
  texelWidth: number;
  texelHeight: number;
} {
  if (!envMap?.image) {
    return { maxMip: 8, texelWidth: 1 / 256, texelHeight: 1 / 256 };
  }
  const image = envMap.image as { width?: number; height?: number };
  const width = Math.max(1, image.width ?? 256);
  const height = Math.max(1, image.height ?? 256);
  // Matches three WebGLPrograms cubeUVMaxMip for PMREM atlases.
  const maxMip = Math.max(0, Math.log2(height) - 2);
  return {
    maxMip,
    texelWidth: 1 / width,
    texelHeight: 1 / height,
  };
}
