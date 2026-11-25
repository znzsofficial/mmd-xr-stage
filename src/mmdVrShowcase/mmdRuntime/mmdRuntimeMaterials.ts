import type { ThreeMmdModel } from "@yohawing/three-mmd-loader";
import * as THREE from "three";
import { attachMmdMaterialEnhance, syncMmdMaterialEnhance, type MmdMaterialEnhanceState } from "./mmdMaterialEnhance";
export { configureDraws as applyMaterialVisibility } from '../wardrobe/draws';

export type MaterialOverride = {
  opacity: number;
  metallic: number;
  roughness: number;
  occlusion: number;
  emission: number;
  emissionColor: string;
  envInfluence: number;
  specularMode: "mmd" | "mmd+env" | "env";
  lightingModel: "toon" | "pbr";
  aoMapFile: File | null;
  emissionMapFile: File | null;
  maskMapFile: File | null;
};

export const DEFAULT_MATERIAL_OVERRIDE: MaterialOverride = Object.freeze({
  opacity: 1,
  metallic: 0,
  roughness: 0.55,
  occlusion: 1,
  emission: 0,
  emissionColor: "#ffffff",
  envInfluence: 0,
  specularMode: "mmd",
  lightingModel: "toon",
  aoMapFile: null,
  emissionMapFile: null,
  maskMapFile: null,
});

export type MaterialPipelineEntry = {
  id: string;
  model: ThreeMmdModel;
  materialNames: string[];
  materialVisible: Record<string, boolean>;
  materialOverrides: Record<string, MaterialOverride>;
  visible: boolean;
};

type EnhancementTextures = {
  aoMap?: THREE.Texture | null;
  emissionMap?: THREE.Texture | null;
  maskMap?: THREE.Texture | null;
};

const mapKeys = ["aoMap", "emissionMap", "maskMap"] as const;
type Files = readonly (File | null)[];
type TextureRequest = { files: Files; staged: EnhancementTextures; done: Promise<void> };
const pending = new WeakMap<THREE.Material, TextureRequest>();
const committedFiles = new WeakMap<THREE.Material, Files>();
const emptyFiles = [null, null, null] as const;

export function createDefaultMaterialOverrides(names: string[]) {
  const overrides: Record<string, MaterialOverride> = {};
  for (const name of names) {
    overrides[name] = { ...DEFAULT_MATERIAL_OVERRIDE };
  }
  return overrides;
}

function sameFiles(a: Files, b: Files) {
  return a.every((file, i) => file === b[i]);
}

async function loadTextureFromFile(file: File, key: typeof mapKeys[number]) {
  const url = URL.createObjectURL(file);
  try {
    const texture = await new THREE.TextureLoader().loadAsync(url);
    texture.colorSpace = key === "emissionMap" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.flipY = false; // PMX UVs address the source image from the top, like the loader's diffuse map.
    texture.needsUpdate = true;
    return texture;
  } finally { URL.revokeObjectURL(url); }
}

function release(maps: EnhancementTextures | undefined) {
  if (!maps) return;
  for (const key of mapKeys) {
    maps[key]?.dispose();
    maps[key] = null;
  }
}

function cancelPending(material: THREE.Material) {
  const old = pending.get(material);
  pending.delete(material);
  release(old?.staged);
}

export function disposeEnhancementTextures(material: THREE.Material) {
  const userData = material.userData as Record<string, unknown>;
  cancelPending(material);
  committedFiles.delete(material);
  release(userData.mmdEnhanceTextures as EnhancementTextures | undefined);
  delete userData.mmdEnhanceTextures;
}

const singleMaterialCache = new WeakMap<THREE.Material, THREE.Material[]>();

export function getMeshMaterials(mesh: { material: THREE.Material | THREE.Material[] }): THREE.Material[] {
  const mat = mesh.material;
  if (Array.isArray(mat)) return mat;
  let cached = singleMaterialCache.get(mat);
  if (!cached) {
    cached = [mat];
    singleMaterialCache.set(mat, cached);
  }
  return cached;
}

export function disposeEntryEnhancementTextures(entry: MaterialPipelineEntry) {
  const materials = getMeshMaterials(entry.model.mesh);
  materials.forEach((material) => {
    if (material) disposeEnhancementTextures(material);
  });
}

function syncEnhancementTextures(material: THREE.Material, override: MaterialOverride, name: string) {
  const files = [override.aoMapFile, override.emissionMapFile, override.maskMapFile];
  const previous = pending.get(material);
  if (previous && sameFiles(previous.files, files)) return previous.done;
  cancelPending(material); // Includes selecting the already committed set again.
  if (sameFiles(committedFiles.get(material) ?? emptyFiles, files)) return;
  // Request identity is never recycled, even if a material is disposed and reused.
  const request: TextureRequest = { files, staged: {}, done: Promise.resolve() };
  pending.set(material, request);
  request.done = (async () => {
    try {
      for (const [i, key] of mapKeys.entries()) {
        const file = files[i];
        if (!file) continue;
        const texture = await loadTextureFromFile(file, key);
        if (pending.get(material) !== request) { texture.dispose(); return; }
        request.staged[key] = texture;
      }
    } catch (error) {
      if (pending.get(material) === request) {
        cancelPending(material);
        console.warn(`[mmdVr] Enhancement textures for ${name} could not be loaded; retaining previous maps`, error);
      }
      return;
    }
    const oldMaps = material.userData.mmdEnhanceTextures;
    material.userData.mmdEnhanceTextures = request.staged;
    committedFiles.set(material, files);
    pending.delete(material);
    try {
      const state = material.userData.mmdEnhanceState as MmdMaterialEnhanceState | undefined;
      if (state) syncMmdMaterialEnhance(material, state);
      material.needsUpdate = true;
    } finally { release(oldMaps); }
  })();
  return request.done;
}

function convertMaterialForWebGpu(source: THREE.Material): THREE.Material {
  if (source.userData?.mmdWebGpuStripped && source.type === "MeshStandardMaterial") {
    return source;
  }

  const src = source as THREE.MeshToonMaterial & {
    map?: THREE.Texture | null;
    color?: THREE.Color;
    emissive?: THREE.Color;
    opacity?: number;
    transparent?: boolean;
    side?: THREE.Side;
    alphaTest?: number;
    depthWrite?: boolean;
    colorWrite?: boolean;
    name?: string;
    visible?: boolean;
  };

  // MMD MeshToon + onBeforeCompile ignores scene lights. On WebGPU we rebuild a
  // MeshStandardMaterial so directional/ambient lights work with real normals.
  const next = new THREE.MeshStandardMaterial({
    name: src.name,
    color: src.color?.clone?.() ?? new THREE.Color(0xffffff),
    map: src.map ?? null,
    emissive: new THREE.Color(0x000000),
    emissiveIntensity: 0,
    roughness: 0.72,
    metalness: 0.05,
    opacity: src.opacity ?? 1,
    transparent: Boolean(src.transparent || (src.opacity ?? 1) < 0.999),
    alphaTest: src.alphaTest ?? 0,
    side: src.side ?? THREE.FrontSide,
    depthWrite: src.depthWrite ?? true,
    colorWrite: src.colorWrite ?? true,
    visible: src.visible !== false,
  });
  next.userData = {
    ...src.userData,
    mmdWebGpuStripped: true,
    mmdMaterialFactorShader: undefined,
    mmdSphereShader: undefined,
    mmdEnhanceAttached: undefined,
    mmdEnhanceShader: undefined,
    // Prevent material-sync ambient→emissive flat fill on the non-shader path.
    mmdMaterialFactors: { shaderApplied: true },
  };
  next.needsUpdate = true;
  return next;
}

/** WebGPU NodeBuilder rejects classic onBeforeCompile materials used by MMD + enhance. */
export function stripWebGlOnlyMaterialShaders(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Empty index buffers spam WebGPU "Draw with index count of 0".
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    const index = geometry?.getIndex?.() ?? geometry?.index ?? null;
    if (index && index.count === 0) {
      mesh.visible = false;
      return;
    }
    const position = geometry?.getAttribute?.("position") as THREE.BufferAttribute | undefined;
    if (position && position.count === 0) {
      mesh.visible = false;
      return;
    }

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => (material ? convertMaterialForWebGpu(material) : material));
    } else if (mesh.material) {
      mesh.material = convertMaterialForWebGpu(mesh.material);
    }
  });
}

export type MaterialLightingContext = {
  balancedModelColor?: boolean;
  envIntensity?: number;
  ambientIntensity?: number;
  envMap?: THREE.Texture | null;
  lightDirection?: THREE.Vector3 | null;
  lightIntensity?: number;
  lightColor?: THREE.Color | null;
};

function applyMaterialOverrideToMaterial(
  material: THREE.Material,
  modelId: string,
  name: string,
  override: MaterialOverride,
  ctx: MaterialLightingContext,
) {
  // Official TSL materials (WebGPU pipeline) — do not inject classic enhance.
  if (material.userData?.mmdTslMaterialUniforms || material.userData?.mmdTslOutlineMaterial) return;
  // Skip WebGL-only enhance injection on WebGPU MeshStandard fallback.
  if (material.userData?.mmdWebGpuStripped) {
    const std = material as THREE.MeshStandardMaterial;
    if ("roughness" in std) {
      std.roughness = override.roughness;
      std.metalness = override.metallic;
      std.envMapIntensity = Math.max(0, override.envInfluence) * (ctx.envIntensity ?? 0);
      if (std.envMap) {
        std.envMap = null;
        std.needsUpdate = true;
      }
    }
    return;
  }
  attachMmdMaterialEnhance(material);
  const state = (material.userData.mmdEnhanceState ??= {}) as MmdMaterialEnhanceState;
  state.modelId = modelId;
  state.materialName = name;
  state.override = override;
  state.envIntensity = ctx.envIntensity ?? 0;
  state.ambientIntensity = ctx.ambientIntensity ?? 0.55;
  state.balancedModelColor = ctx.balancedModelColor;
  state.envMap = ctx.envMap ?? null;
  state.lightDirection = ctx.lightDirection ?? null;
  state.lightIntensity = ctx.lightIntensity;
  state.lightColor = ctx.lightColor ?? null;
  syncMmdMaterialEnhance(material, state);
}

export function applyMaterialOverrides(
  entry: MaterialPipelineEntry,
  envIntensityOrCtx: number | MaterialLightingContext = 0,
  ambientIntensity = 0.55,
) {
  const ctx: MaterialLightingContext =
    typeof envIntensityOrCtx === "number"
      ? { envIntensity: envIntensityOrCtx, ambientIntensity }
      : envIntensityOrCtx;

  const materials = getMeshMaterials(entry.model.mesh);
  materials.forEach((material, index) => {
    if (!material) return;
    const name = entry.materialNames[index] ?? `Material ${index + 1}`;
    const override = entry.materialOverrides[name] ?? DEFAULT_MATERIAL_OVERRIDE;
    applyMaterialOverrideToMaterial(material, entry.id, name, override, ctx);
  });
}

export function applyMaterialOverride(
  entry: MaterialPipelineEntry,
  materialName: string,
  ctx: MaterialLightingContext,
) {
  const materials = getMeshMaterials(entry.model.mesh);
  materials.forEach((material, index) => {
    if (!material) return;
    const name = entry.materialNames[index] ?? `Material ${index + 1}`;
    if (name !== materialName) return;
    const override = entry.materialOverrides[name] ?? DEFAULT_MATERIAL_OVERRIDE;
    applyMaterialOverrideToMaterial(material, entry.id, name, override, ctx);
  });
}

export async function refreshMaterialTextures(entry: MaterialPipelineEntry) {
  await Promise.all(getMeshMaterials(entry.model.mesh).map((material, index) => {
    const name = entry.materialNames[index] ?? `Material ${index + 1}`;
    const override = entry.materialOverrides[name];
    if (material && override) return syncEnhancementTextures(material, override, name);
  }));
}

export function mergeMaterialOverride(
  current: MaterialOverride | undefined,
  patch: Partial<MaterialOverride>,
): MaterialOverride {
  return {
    ...(current ?? DEFAULT_MATERIAL_OVERRIDE),
    ...patch,
  };
}
