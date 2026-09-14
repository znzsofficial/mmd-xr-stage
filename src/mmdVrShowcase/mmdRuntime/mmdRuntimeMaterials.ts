import type { ThreeMmdModel } from "@yohawing/three-mmd-loader";
import * as THREE from "three";
import { attachMmdMaterialEnhance, syncMmdMaterialEnhance } from "./mmdMaterialEnhance";

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

type EnhancementTextureState = EnhancementTextures & {
  signature: string;
  requestId: number;
};

export function createDefaultMaterialOverrides(names: string[]) {
  const overrides: Record<string, MaterialOverride> = {};
  for (const name of names) {
    overrides[name] = { ...DEFAULT_MATERIAL_OVERRIDE };
  }
  return overrides;
}

function textureSignature(override: MaterialOverride) {
  return [
    override.aoMapFile?.name ?? "",
    override.aoMapFile?.lastModified ?? 0,
    override.emissionMapFile?.name ?? "",
    override.emissionMapFile?.lastModified ?? 0,
    override.maskMapFile?.name ?? "",
    override.maskMapFile?.lastModified ?? 0,
  ].join("|");
}

function loadTextureFromFile(file: File) {
  return new Promise<THREE.Texture>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        URL.revokeObjectURL(url);
        resolve(texture);
      },
      undefined,
      (error) => {
        URL.revokeObjectURL(url);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export function disposeEnhancementTextures(material: THREE.Material) {
  const userData = material.userData as Record<string, unknown>;
  const prev = userData.mmdEnhanceTextures as EnhancementTextureState | undefined;
  prev?.aoMap?.dispose?.();
  prev?.emissionMap?.dispose?.();
  prev?.maskMap?.dispose?.();
  delete userData.mmdEnhanceTextures;
  delete userData.mmdEnhanceTextureRequestId;
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

async function syncEnhancementTextures(entry: MaterialPipelineEntry) {
  const materials = getMeshMaterials(entry.model.mesh);
  await Promise.all(materials.map(async (material, index) => {
    if (!material) return;
    const name = entry.materialNames[index] ?? `Material ${index + 1}`;
    const override = entry.materialOverrides[name];
    if (!override) return;
    const userData = material.userData as Record<string, unknown>;
    const nextSignature = textureSignature(override);
    const prev = userData.mmdEnhanceTextures as EnhancementTextureState | undefined;
    if (prev && prev.signature === nextSignature) return;
    const nextRequestId = ((prev?.requestId ?? 0) + 1) >>> 0;
    userData.mmdEnhanceTextureRequestId = nextRequestId;
    const next: EnhancementTextures = { aoMap: null, emissionMap: null, maskMap: null };
    if (override.aoMapFile) next.aoMap = await loadTextureFromFile(override.aoMapFile);
    if (override.emissionMapFile) next.emissionMap = await loadTextureFromFile(override.emissionMapFile);
    if (override.maskMapFile) next.maskMap = await loadTextureFromFile(override.maskMapFile);
    if (userData.mmdEnhanceTextureRequestId !== nextRequestId) {
      next.aoMap?.dispose?.();
      next.emissionMap?.dispose?.();
      next.maskMap?.dispose?.();
      return;
    }
    prev?.aoMap?.dispose?.();
    prev?.emissionMap?.dispose?.();
    prev?.maskMap?.dispose?.();
    userData.mmdEnhanceTextures = { ...next, signature: nextSignature, requestId: nextRequestId } satisfies EnhancementTextureState;
    material.needsUpdate = true;
  }));
}

export function applyMaterialVisibility(entry: MaterialPipelineEntry) {
  const materials = getMeshMaterials(entry.model.mesh);
  materials.forEach((material, index) => {
    if (!material) return;
    const name = entry.materialNames[index] ?? `Material ${index + 1}`;
    const visible = entry.materialVisible[name] !== false;
    material.visible = visible && entry.visible;
  });

  for (const proxy of [...entry.model.outlineMeshes, ...entry.model.renderOrderMeshes]) {
    const mats = Array.isArray(proxy.material) ? proxy.material : [proxy.material];
    mats.forEach((material) => {
      if (!material) return;
      const name = material.name || entry.materialNames[0];
      const visible = !name || entry.materialVisible[name] !== false;
      material.visible = visible && entry.visible;
    });
    proxy.visible = entry.visible;
  }
  entry.model.root.visible = entry.visible;
  entry.model.mesh.visible = entry.visible;
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
      if (std.envMap) std.envMap = null;
      std.needsUpdate = true;
    }
    return;
  }
  attachMmdMaterialEnhance(material);
  syncMmdMaterialEnhance(material, {
    modelId,
    materialName: name,
    override,
    envIntensity: ctx.envIntensity ?? 0,
    ambientIntensity: ctx.ambientIntensity ?? 0.55,
    envMap: ctx.envMap ?? null,
    lightDirection: ctx.lightDirection ?? null,
    lightIntensity: ctx.lightIntensity,
    lightColor: ctx.lightColor ?? null,
  });
}

export function applyMaterialOverrides(
  entry: MaterialPipelineEntry,
  envIntensityOrCtx: number | MaterialLightingContext = 0,
  ambientIntensity = 0.55,
) {
  const ctx: MaterialLightingContext =
    typeof envIntensityOrCtx === "number"
      ? { envIntensity: envIntensityOrCtx, ambientIntensity }
      : { ambientIntensity: 0.55, ...envIntensityOrCtx };

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

export function refreshMaterialTextures(entry: MaterialPipelineEntry) {
  void syncEnhancementTextures(entry).catch(() => {
    // ignore texture load failures
  });
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
