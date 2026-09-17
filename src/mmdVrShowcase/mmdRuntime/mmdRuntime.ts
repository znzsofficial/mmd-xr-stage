import {
  applyMmdCameraStateToThreeCamera,
  syncMmdSpecularDirection,
  ThreeMmdLoader,
  type MmdAnimation,
  type ThreeMmdModel,
  type TextureResolver,
} from "@yohawing/three-mmd-loader";
import type { MmdPhysicsBackend } from "@yohawing/three-mmd-loader/physics";
import { DefaultMmdRuntime } from "@yohawing/three-mmd-loader/runtime";
import * as THREE from "three";
import { resolveCompanion } from "../../mmdImport/assetPaths";
import { createBulletPhysicsBackend, type MmdPhysicsQuality } from "./mmdPhysics";
import {
  applyMaterialOverride,
  applyMaterialOverrides,
  applyMaterialVisibility,
  createDefaultMaterialOverrides,
  getMeshMaterials,
  mergeMaterialOverride,
  refreshMaterialTextures,
  type MaterialOverride,
} from "./mmdRuntimeMaterials";
import {
  applyModelTransform,
  applyMorphOverrides,
  cloneTransform,
  DEFAULT_MODEL_TRANSFORM,
  disposeLoadedModelObject,
  disposeModelObject,
  enableModelShadows,
  enforceModelCastOnlyShadows,
  extractMaterialNames,
  extractMorphNames,
  recomputeEntryAnimation,
  toSnapshot,
  type MmdModelTransform,
  type RuntimeEntry,
  type RuntimeModelSnapshot,
} from "./mmdRuntimeEntry";

export type { MaterialOverride } from "./mmdRuntimeMaterials";
export type { MmdModelTransform, RuntimeModelSnapshot } from "./mmdRuntimeEntry";
export { cloneTransform, DEFAULT_MODEL_TRANSFORM };

export type MmdLoadReport = {
  textureCount: number;
  missingTextures: string[];
  textureWarnings: string[];
  modelId: string;
  morphNames: string[];
  materialNames: string[];
};

export type MmdMotionSlot = "body" | "face" | "camera";

export type MmdProjectModelAssets = {
  id: string;
  name: string;
  visible: boolean;
  morphWeights: Record<string, number>;
  morphFavorites: string[];
  materialVisible: Record<string, boolean>;
  materialOverrides: Record<string, MaterialOverride>;
  modelFile: File;
  companionFiles: File[];
  bodyMotionFile: File | null;
  faceMotionFile: File | null;
  cameraMotionFile: File | null;
  transform: MmdModelTransform;
};

export type MmdAddModelOptions = {
  physics?: boolean;
  preferredId?: string;
  transform?: Partial<MmdModelTransform>;
  /** @deprecated use transform.positionX */
  offsetX?: number;
};

export type MmdRuntimeHandle = {
  hasCameraTrack: boolean;
  duration: number;
  selectedId: string | null;
  listModels: () => RuntimeModelSnapshot[];
  exportProjectModels: () => MmdProjectModelAssets[];
  clearAll: () => void;
  addModel: (modelFile: File, companionFiles?: readonly File[], options?: MmdAddModelOptions) => Promise<MmdLoadReport>;
  removeModel: (id: string) => void;
  selectModel: (id: string | null) => void;
  /** Scene root Object3D for gizmo / helpers (null if missing). */
  getModelRoot: (id: string | null) => THREE.Object3D | null;
  setModelVisible: (id: string, visible: boolean) => void;
  setModelTransform: (id: string, patch: Partial<MmdModelTransform>) => void;
  /** When true, update() will not overwrite root TRS from entry.transform (gizmo drag). */
  setModelGizmoLock: (id: string, locked: boolean) => void;
  loadMotion: (file: File, slot?: MmdMotionSlot, modelId?: string | null) => Promise<void>;
  setMorphWeight: (modelId: string, morphName: string, weight: number) => void;
  setMaterialVisible: (modelId: string, materialName: string, visible: boolean) => void;
  setMaterialOverride: (modelId: string, materialName: string, patch: Partial<MaterialOverride>) => void;
  setLighting: (options: {
    envIntensity: number;
    ambientIntensity?: number;
    directionalLight: THREE.DirectionalLight | null;
    /** PMREM CubeUV from sky (WebGL toon IBL). */
    envMap?: THREE.Texture | null;
  }) => void;
  setPhysicsEnabled: (enabled: boolean) => Promise<void>;
  rebuildPhysics: () => Promise<void>;
  /** Re-seed soft-body pose from current animation (fix floating / stuck cloth). */
  resetPhysics: (seconds?: number) => void;
  getControllerContactCount: (controllerIndex?: number) => number;
  getRigidBodyCount: () => number;
  getDynamicRigidBodyCount: () => number;
  getPhysicsStepCount: () => number;
  update: (seconds: number, physics: boolean, camera: THREE.PerspectiveCamera, aspect: number, useMotionCamera: boolean) => void;
  dispose: () => void;
};

type RuntimeEntryWithPhysics = RuntimeEntry & {
  /** Dedicated Bullet world — do not share across models. */
  physicsBackend: MmdPhysicsBackend | null;
};

let nextModelSeq = 1;

const STATIC_PHYSICS_BINDING_ANIMATION: MmdAnimation = {
  kind: "vmd",
  bytes: new Uint8Array(0),
  metadata: {
    modelName: "",
    counts: { bones: 0, morphs: 0, cameras: 0, lights: 0, selfShadows: 0, properties: 0 },
    maxFrame: 0,
  },
  boneTracks: {},
  morphTracks: {},
  cameraFrames: [],
  lightFrames: [],
  selfShadowFrames: [],
  propertyFrames: [],
};

export function bindStaticMmdPhysicsRuntime(model: Pick<ThreeMmdModel, "setAnimation">) {
  model.setAnimation(STATIC_PHYSICS_BINDING_ANIMATION);
}

export function createLocalTextureResolver(modelFile: File, companionFiles: readonly File[] = []): TextureResolver {
  const allFiles = companionFiles.length ? companionFiles : [modelFile];
  return {
    async resolve(path) {
      const { matches } = resolveCompanion(modelFile, path, allFiles);
      return matches.length === 1 ? matches[0] : undefined;
    },
  };
}

/**
 * Root transform must be in matrixWorld before Bullet samples bone world matrices.
 * `physicsStep: true` forces root scale=1 (collider sizes are model-unit, not scaled).
 */
function syncEntryWorldMatrix(entry: RuntimeEntry, physicsStep = false) {
  // Gizmo owns pos/rot; still force unit scale for Bullet, then restore visual scale.
  if (entry.gizmoLock) {
    if (physicsStep) {
      entry.model.root.scale.setScalar(1);
    } else {
      const scale = Math.min(10, Math.max(0.01, entry.transform.scale));
      entry.model.root.scale.setScalar(scale);
    }
    entry.model.root.updateMatrixWorld(true);
    return;
  }
  applyModelTransform(entry, { physicsStep });
  entry.model.root.updateMatrixWorld(true);
}

function disposeEntryPhysics(entry: RuntimeEntryWithPhysics) {
  try {
    entry.physicsBackend?.dispose?.();
  } catch {
    // ignore
  }
  entry.physicsBackend = null;
}

export class MmdRuntimeRebuildError extends AggregateError {
  readonly code = "MMD_RUNTIME_REBUILD_RESTORE_FAILED";

  constructor(rebuildError: unknown, restoreError: unknown) {
    super([rebuildError, restoreError], "Failed to rebuild and restore MMD models");
    this.name = "MmdRuntimeRebuildError";
  }
}

export function isMmdRuntimeRebuildError(error: unknown): error is MmdRuntimeRebuildError {
  return error instanceof MmdRuntimeRebuildError
    || (error instanceof Error && "code" in error && error.code === "MMD_RUNTIME_REBUILD_RESTORE_FAILED");
}

export type MmdRuntimeOptions = {
  controllerColliders?: () => readonly THREE.Matrix4[];
  controllerCollidersEnabled?: () => boolean;
  controllerColliderRadius?: () => number;
  controllerColliderFriction?: () => number;
  controllerColliderRestitution?: () => number;
  handColliders?: () => readonly THREE.Matrix4[];
  handCollidersEnabled?: () => boolean;
  handColliderRadius?: () => number;
  physicsQuality?: () => MmdPhysicsQuality;
  physicsBoneFeedbackScale?: () => number;
  physicsDynamicSelfCollision?: () => boolean;
  prepareModel?: (root: THREE.Object3D) => void;
};

export function createMmdRuntimeHandle(scene: THREE.Scene, options: MmdRuntimeOptions = {}): MmdRuntimeHandle {
  let disposed = false;
  const assertActive = () => {
    if (disposed) throw new DOMException("MMD runtime disposed", "AbortError");
  };
  const entries = new Map<string, RuntimeEntryWithPhysics>();
  let selectedId: string | null = null;
  let physicsWanted = false;
  let physicsTransition: Promise<void> = Promise.resolve();
  /** Last evaluated timeline seconds per model (for seek / physics continuity). */
  const lastPhysicsSeconds = new Map<string, number>();
  let duration = 0;
  let hasCameraTrack = false;
  let envIntensity = 0;
  let ambientIntensity = 0.55;
  let directionalLight: THREE.DirectionalLight | null = null;
  let envMap: THREE.Texture | null = null;
  const lightDirWorld = new THREE.Vector3(0.35, 0.9, 0.25);
  const lightColor = new THREE.Color(1, 1, 1);
  let lightIntensity = 1;
  const controllerColliders = options.controllerColliders;
  const controllerCollidersEnabled = options.controllerCollidersEnabled;
  const controllerColliderRadius = options.controllerColliderRadius;
  const handColliders = options.handColliders;
  const handCollidersEnabled = options.handCollidersEnabled;
  const handColliderRadius = options.handColliderRadius;
  const physicsQuality = options.physicsQuality;
  let physicsDynamicSelfCollision = options.physicsDynamicSelfCollision?.() ?? false;
  const prepareModel = options.prepareModel;

  function lightingContext() {
    // Shared vectors — consumers copy into uniforms immediately.
    return {
      envIntensity,
      ambientIntensity,
      envMap,
      lightDirection: lightDirWorld,
      lightIntensity,
      lightColor,
    };
  }

  function refreshDirectionalLightState() {
    if (!directionalLight || !directionalLight.visible) {
      lightIntensity = 0;
      lightColor.setRGB(1, 1, 1);
      lightDirWorld.set(0.35, 0.9, 0.25).normalize();
      return;
    }
    // Zero sun intensity must kill GGX (no ghost specular).
    lightIntensity = Math.max(0, directionalLight.intensity);
    lightColor.copy(directionalLight.color);
    // Surface → light (directional light at pos targeting origin).
    lightDirWorld.copy(directionalLight.position).normalize();
    if (lightDirWorld.lengthSq() < 1e-6) lightDirWorld.set(0.35, 0.9, 0.25).normalize();
  }

  function recomputeGlobal() {
    duration = 0;
    hasCameraTrack = false;
    for (const entry of entries.values()) {
      duration = Math.max(duration, entry.duration);
      if (entry.hasCameraTrack) hasCameraTrack = true;
    }
  }

  function removeEntry(id: string) {
    const entry = entries.get(id);
    if (!entry) return;
    scene.remove(entry.model.root);
    disposeEntryPhysics(entry);
    disposeModelObject(entry);
    entries.delete(id);
    lastPhysicsSeconds.delete(id);
    if (selectedId === id) {
      selectedId = entries.keys().next().value ?? null;
    }
    recomputeGlobal();
  }

  async function createEntry(
    modelFile: File,
    companionFiles: readonly File[],
    withPhysics: boolean,
    transform: MmdModelTransform,
    preferredId?: string,
  ) {
    assertActive();
    const textureResolver = createLocalTextureResolver(modelFile, companionFiles);
    let colliderRoot: THREE.Object3D | null = null;
    const unitRoot = new THREE.Matrix4();
    const inverseVisualRoot = new THREE.Matrix4();
    const mappedCollider = new THREE.Matrix4();
    const visualRoot = new THREE.Matrix4();
    const visualScale = new THREE.Vector3();
    const createMappedColliderProvider = (
      getWorldMatrices: (() => readonly THREE.Matrix4[]) | undefined,
      getEnabled: (() => boolean) | undefined,
      slotCount: number,
    ) => {
      if (!getWorldMatrices) return undefined;
      const colliderMatrices = Array.from({ length: slotCount }, () => new Float32Array(16));
      return () => {
        const root = colliderRoot;
        const worldMatrices = getWorldMatrices();
        if (!root || worldMatrices.length !== colliderMatrices.length) return [];
        root.updateWorldMatrix(true, false);
        unitRoot.copy(root.matrixWorld);
        const scale = Math.min(10, Math.max(0.01, Number(root.userData.mmdVisualScale) || 1));
        visualRoot.copy(unitRoot).scale(visualScale.setScalar(scale));
        inverseVisualRoot.copy(visualRoot).invert();
        for (let index = 0; index < colliderMatrices.length; index += 1) {
          if (getEnabled?.() === false) {
            mappedCollider.makeTranslation(0, -1_000, 0);
          } else {
            mappedCollider.multiplyMatrices(unitRoot, inverseVisualRoot).multiply(worldMatrices[index]);
          }
          const source = mappedCollider.elements;
          const target = colliderMatrices[index];
          for (let column = 0; column < 4; column += 1) {
            for (let row = 0; row < 4; row += 1) {
              const rowSign = row === 2 ? -1 : 1;
              const columnSign = column === 2 ? -1 : 1;
              target[column * 4 + row] = rowSign * source[column * 4 + row] * columnSign;
            }
          }
        }
        return colliderMatrices;
      };
    };
    const colliderProvider = createMappedColliderProvider(controllerColliders, controllerCollidersEnabled, 2);
    const handColliderProvider = createMappedColliderProvider(
      handColliders,
      handCollidersEnabled,
      handColliders?.().length ?? 0,
    );
    // One Bullet world per model (library world holds a single uploaded model identity).
    const physicsBackend = withPhysics
      ? await createBulletPhysicsBackend({
          controllerColliders: colliderProvider,
          controllerRadius: () => {
            const scale = Math.min(10, Math.max(0.01, Number(colliderRoot?.userData.mmdVisualScale) || transform.scale));
            return (controllerColliderRadius?.() ?? 0.08) / scale;
          },
          handColliders: handColliderProvider,
          handRadius: () => {
            const scale = Math.min(10, Math.max(0.01, Number(colliderRoot?.userData.mmdVisualScale) || transform.scale));
            return (handColliderRadius?.() ?? 0.035) / scale;
          },
          quality: physicsQuality,
          boneFeedbackScale: options.physicsBoneFeedbackScale,
          controllerFriction: options.controllerColliderFriction,
          controllerRestitution: options.controllerColliderRestitution,
          dynamicSelfCollision: physicsDynamicSelfCollision,
        })
      : null;
    if (disposed) {
      physicsBackend?.dispose?.();
      assertActive();
    }
    const runtimeOptions = withPhysics && physicsBackend
      ? {
          physics: "external" as const,
          physicsBackend,
        }
      : { physics: "none" as const };

    const loader = new ThreeMmdLoader({
      textureResolver,
      runtime: runtimeOptions,
      ...(withPhysics ? { runtimeFactory: () => new DefaultMmdRuntime(runtimeOptions) } : {}),
    });
    let model;
    try {
      model = await loader.loadModel(modelFile);
      if (withPhysics) bindStaticMmdPhysicsRuntime(model);
      colliderRoot = model.root;
      prepareModel?.(model.root);
      if (disposed) {
        disposeLoadedModelObject(model);
        assertActive();
      }
    } catch (error) {
      physicsBackend?.dispose?.();
      throw error;
    }

    enableModelShadows(model);
    enforceModelCastOnlyShadows(model.root);
    scene.add(model.root);

    const morphNames = extractMorphNames(model);
    const materialNames = extractMaterialNames(model);
    const materialVisible: Record<string, boolean> = {};
    for (const name of materialNames) materialVisible[name] = true;

    const missingTextures = model.diagnostics.textures
      .filter((item) => item.code === "TEXTURE_RESOLVE_FAILED")
      .map((item) => item.path)
      .filter(Boolean);
    const textureWarnings = model.diagnostics.textures
      .map((item) => `${item.code}: ${item.path}`)
      .filter(Boolean);
    const uniqueTextureFiles = new Set(companionFiles.filter((file) => /\.(png|jpe?g|bmp|dds|gif|tga|webp|sph|spa)$/i.test(file.name)));

    let id = preferredId && !entries.has(preferredId) ? preferredId : `mmd-model-${nextModelSeq++}`;
    if (preferredId && entries.has(preferredId)) id = `mmd-model-${nextModelSeq++}`;
    const entry: RuntimeEntryWithPhysics = {
      id,
      name: modelFile.name,
      model,
      bodyAnimation: null,
      faceAnimation: null,
      cameraAnimation: null,
      appliedAnimation: null,
      bodyMotionName: null,
      faceMotionName: null,
      cameraMotionName: null,
      bodyMotionFile: null,
      faceMotionFile: null,
      cameraMotionFile: null,
      visible: true,
      morphNames,
      materialNames,
      morphWeights: {},
      morphFavorites: [],
      materialVisible,
      materialOverrides: createDefaultMaterialOverrides(materialNames),
      transform: cloneTransform(transform),
      hasCameraTrack: false,
      duration: 0,
      modelFile,
      companionFiles: companionFiles.length ? [...companionFiles] : [modelFile],
      physicsBackend,
    };
    model.root.userData.mmdVisualScale = entry.transform.scale;
    // Tag root + meshes so post FX (DOF lock / selective bloom) can target a model id.
    model.root.userData.mmdModelId = id;
    model.root.traverse((object) => {
      object.userData.mmdModelId = id;
    });
    entries.set(id, entry);
    syncEntryWorldMatrix(entry);
    applyMaterialVisibility(entry);
    applyMaterialOverrides(entry, lightingContext());
    refreshMaterialTextures(entry);

    return {
      entry,
      report: {
        textureCount: uniqueTextureFiles.size,
        missingTextures: [...new Set(missingTextures)],
        textureWarnings: [...new Set(textureWarnings)],
        modelId: id,
        morphNames,
        materialNames,
      } satisfies MmdLoadReport,
    };
  }

  async function rebuildAllModels(withPhysics: boolean, beforeRestore?: () => void) {
    const snapshots = [...entries.values()].map((entry) => ({
      id: entry.id,
      bodyAnimation: entry.bodyAnimation,
      faceAnimation: entry.faceAnimation,
      cameraAnimation: entry.cameraAnimation,
      bodyMotionName: entry.bodyMotionName,
      faceMotionName: entry.faceMotionName,
      cameraMotionName: entry.cameraMotionName,
      bodyMotionFile: entry.bodyMotionFile,
      faceMotionFile: entry.faceMotionFile,
      cameraMotionFile: entry.cameraMotionFile,
      visible: entry.visible,
      morphWeights: { ...entry.morphWeights },
      morphFavorites: [...entry.morphFavorites],
      materialVisible: { ...entry.materialVisible },
      materialOverrides: { ...entry.materialOverrides },
      modelFile: entry.modelFile,
      companionFiles: entry.companionFiles,
      transform: cloneTransform(entry.transform),
    }));
    const previousSelected = selectedId;
    const previousPhysics = [...entries.values()].every((entry) => entry.physicsBackend != null);

    async function restoreSnapshots(physics: boolean) {
      for (const snap of snapshots) {
        const { entry } = await createEntry(snap.modelFile, snap.companionFiles, physics, snap.transform, snap.id);
        entry.bodyAnimation = snap.bodyAnimation;
        entry.faceAnimation = snap.faceAnimation;
        entry.cameraAnimation = snap.cameraAnimation;
        entry.bodyMotionName = snap.bodyMotionName;
        entry.faceMotionName = snap.faceMotionName;
        entry.cameraMotionName = snap.cameraMotionName;
        entry.bodyMotionFile = snap.bodyMotionFile;
        entry.faceMotionFile = snap.faceMotionFile;
        entry.cameraMotionFile = snap.cameraMotionFile;
        entry.visible = snap.visible;
        entry.morphWeights = snap.morphWeights;
        entry.morphFavorites = snap.morphFavorites;
        entry.materialVisible = { ...entry.materialVisible, ...snap.materialVisible };
        entry.materialOverrides = { ...entry.materialOverrides, ...snap.materialOverrides };
        recomputeEntryAnimation(entry);
        applyMaterialVisibility(entry);
        applyMaterialOverrides(entry, lightingContext());
        refreshMaterialTextures(entry);
      }
      selectedId = previousSelected && entries.has(previousSelected)
        ? previousSelected
        : entries.keys().next().value ?? null;
      recomputeGlobal();
    }

    for (const id of [...entries.keys()]) removeEntry(id);
    lastPhysicsSeconds.clear();
    try {
      await restoreSnapshots(withPhysics);
    } catch (error) {
      for (const id of [...entries.keys()]) removeEntry(id);
      lastPhysicsSeconds.clear();
      beforeRestore?.();
      try {
        await restoreSnapshots(previousPhysics);
      } catch (restoreError) {
        for (const id of [...entries.keys()]) removeEntry(id);
        lastPhysicsSeconds.clear();
        throw new MmdRuntimeRebuildError(error, restoreError);
      }
      throw error;
    }
  }

  return {
    get hasCameraTrack() {
      return hasCameraTrack;
    },
    get duration() {
      return duration;
    },
    get selectedId() {
      return selectedId;
    },
    listModels() {
      return [...entries.values()].map(toSnapshot);
    },
    exportProjectModels() {
      return [...entries.values()].map((entry) => ({
        id: entry.id,
        name: entry.name,
        visible: entry.visible,
        morphWeights: { ...entry.morphWeights },
        morphFavorites: [...entry.morphFavorites],
        materialVisible: { ...entry.materialVisible },
        materialOverrides: { ...entry.materialOverrides },
        modelFile: entry.modelFile,
        companionFiles: [...entry.companionFiles],
        bodyMotionFile: entry.bodyMotionFile,
        faceMotionFile: entry.faceMotionFile,
        cameraMotionFile: entry.cameraMotionFile,
        transform: cloneTransform(entry.transform),
      }));
    },
    clearAll() {
      for (const id of [...entries.keys()]) removeEntry(id);
      selectedId = null;
      duration = 0;
      hasCameraTrack = false;
    },
    async addModel(modelFile, companionFiles = [], options = {}) {
      physicsWanted = Boolean(options.physics ?? physicsWanted);
      const base: MmdModelTransform = {
        ...DEFAULT_MODEL_TRANSFORM,
        positionX: options.offsetX ?? entries.size * 1.35,
        ...options.transform,
      };
      const transform = cloneTransform(base);
      const { entry, report } = await createEntry(
        modelFile,
        companionFiles.length ? companionFiles : [modelFile],
        physicsWanted,
        transform,
        options.preferredId,
      );
      selectedId = entry.id;
      recomputeGlobal();
      return report;
    },
    removeModel(id) {
      removeEntry(id);
    },
    selectModel(id) {
      if (id && !entries.has(id)) return;
      selectedId = id;
    },
    getModelRoot(id) {
      if (!id) return null;
      return entries.get(id)?.model.root ?? null;
    },
    setModelVisible(id, visible) {
      const entry = entries.get(id);
      if (!entry) return;
      entry.visible = visible;
      applyMaterialVisibility(entry);
      applyMaterialOverrides(entry, lightingContext());
      refreshMaterialTextures(entry);
    },
    setModelTransform(id, patch) {
      const entry = entries.get(id);
      if (!entry) return;
      entry.transform = {
        ...entry.transform,
        ...patch,
      };
      entry.model.root.userData.mmdVisualScale = entry.transform.scale;
      if (!entry.gizmoLock) {
        syncEntryWorldMatrix(entry);
      } else {
        // Keep entry.transform current for physics scale restore; do not stomp gizmo TRS.
        entry.model.root.updateMatrixWorld(true);
      }
    },
    setModelGizmoLock(id, locked) {
      const entry = entries.get(id);
      if (!entry) return;
      entry.gizmoLock = locked;
    },
    setMaterialOverride(modelId, materialName, patch) {
      const entry = entries.get(modelId);
      if (!entry) return;
      entry.materialOverrides[materialName] = mergeMaterialOverride(entry.materialOverrides[materialName], patch);
      applyMaterialOverride(entry, materialName, lightingContext());
      if ("aoMapFile" in patch || "emissionMapFile" in patch || "maskMapFile" in patch) {
        refreshMaterialTextures(entry);
      }
    },
    setLighting(options) {
      envIntensity = Math.max(0, options.envIntensity);
      if (options.ambientIntensity != null) ambientIntensity = Math.max(0, options.ambientIntensity);
      directionalLight = options.directionalLight;
      if (options.envMap !== undefined) envMap = options.envMap;
      refreshDirectionalLightState();
      for (const entry of entries.values()) {
        const materials = getMeshMaterials(entry.model.mesh);
        if (directionalLight) syncMmdSpecularDirection(materials, directionalLight);
        applyMaterialOverrides(entry, lightingContext());
      }
    },
    async loadMotion(file, slot = "body", modelId = selectedId) {
      assertActive();
      const id = modelId ?? selectedId;
      if (!id) throw new Error("No model selected");
      const entry = entries.get(id);
      if (!entry) throw new Error("Model not found");
      const loader = new ThreeMmdLoader();
      const animation = await loader.loadAnimation(file);
      assertActive();
      if (entries.get(id) !== entry) throw new DOMException("MMD model removed", "AbortError");
      if (slot === "face") {
        entry.faceAnimation = animation;
        entry.faceMotionName = file.name;
        entry.faceMotionFile = file;
      } else if (slot === "camera") {
        entry.cameraAnimation = animation;
        entry.cameraMotionName = file.name;
        entry.cameraMotionFile = file;
      } else {
        entry.bodyAnimation = animation;
        entry.bodyMotionName = file.name;
        entry.bodyMotionFile = file;
      }
      recomputeEntryAnimation(entry);
      // setAnimation resets physics state; clear clock so next step is "seeking".
      lastPhysicsSeconds.delete(entry.id);
      recomputeGlobal();
    },
    setMorphWeight(modelId, morphName, weight) {
      const entry = entries.get(modelId);
      if (!entry) return;
      const next = Math.min(1, Math.max(0, weight));
      if (next <= 0.001) {
        delete entry.morphWeights[morphName];
      } else {
        entry.morphWeights[morphName] = next;
      }
    },
    setMaterialVisible(modelId, materialName, visible) {
      const entry = entries.get(modelId);
      if (!entry) return;
      entry.materialVisible[materialName] = visible;
      applyMaterialVisibility(entry);
    },
    async setPhysicsEnabled(enabled) {
      const transition = physicsTransition.then(async () => {
        if (physicsWanted === enabled && entries.size > 0) {
          const allOk = [...entries.values()].every((entry) =>
            enabled ? entry.physicsBackend != null && !entry.physicsBackend.disposed : entry.physicsBackend == null,
          );
          if (allOk) return;
        }
        const previousPhysicsWanted = physicsWanted;
        physicsWanted = enabled;
        if (enabled) physicsDynamicSelfCollision = options.physicsDynamicSelfCollision?.() ?? false;
        lastPhysicsSeconds.clear();
        if (!entries.size) return;
        try {
          await rebuildAllModels(enabled);
        } catch (error) {
          physicsWanted = previousPhysicsWanted;
          throw error;
        }
      });
      physicsTransition = transition.catch(() => undefined);
      await transition;
    },
    async rebuildPhysics() {
      const transition = physicsTransition.then(async () => {
        if (!physicsWanted || !entries.size) return;
        const previousSelfCollision = physicsDynamicSelfCollision;
        physicsDynamicSelfCollision = options.physicsDynamicSelfCollision?.() ?? false;
        if (physicsDynamicSelfCollision === previousSelfCollision) return;
        lastPhysicsSeconds.clear();
        await rebuildAllModels(true, () => {
          physicsDynamicSelfCollision = previousSelfCollision;
        });
      });
      physicsTransition = transition.catch(() => undefined);
      await transition;
    },
    resetPhysics(seconds) {
      if (!physicsWanted) return;
      const t = Number.isFinite(seconds) ? Math.max(0, seconds as number) : 0;
      // Force a "seeking" step without physics:false (which calls reset_world and
      // can leave soft bodies without working body colliders until re-upload).
      // Runtime marks seeking when seconds < previousEvaluateSeconds.
      const ahead = t + 1 / 30;
      for (const entry of entries.values()) {
        if (!entry.visible || !entry.physicsBackend || entry.physicsBackend.disposed) continue;
        try {
          syncEntryWorldMatrix(entry, true);
          entry.model.runtime.seek(ahead);
          entry.model.update(ahead, { physics: true, ik: entry.bodyAnimation != null });
          syncEntryWorldMatrix(entry, true);
          entry.model.runtime.seek(t);
          entry.model.update(t, { physics: true, ik: entry.bodyAnimation != null });
          // Restore visual scale after physics rebind.
          syncEntryWorldMatrix(entry, false);
          lastPhysicsSeconds.set(entry.id, t);
        } catch {
          lastPhysicsSeconds.delete(entry.id);
          try {
            syncEntryWorldMatrix(entry, false);
          } catch {
            // ignore
          }
        }
      }
    },
    getControllerContactCount(controllerIndex) {
      let count = 0;
      for (const entry of entries.values()) {
        const backend = entry.physicsBackend as (MmdPhysicsBackend & {
          debugControllerContactCount?: (controllerIndex?: number) => number;
        }) | null;
        count += backend?.debugControllerContactCount?.(controllerIndex) ?? 0;
      }
      return count;
    },
    getRigidBodyCount() {
      let count = 0;
      for (const entry of entries.values()) {
        const backend = entry.physicsBackend as (MmdPhysicsBackend & { debugRigidBodyCount?: () => number }) | null;
        count += backend?.debugRigidBodyCount?.() ?? 0;
      }
      return count;
    },
    getDynamicRigidBodyCount() {
      let count = 0;
      for (const entry of entries.values()) {
        const backend = entry.physicsBackend as (MmdPhysicsBackend & { debugDynamicRigidBodyCount?: () => number }) | null;
        count += backend?.debugDynamicRigidBodyCount?.() ?? 0;
      }
      return count;
    },
    getPhysicsStepCount() {
      let count = 0;
      for (const entry of entries.values()) {
        const backend = entry.physicsBackend as (MmdPhysicsBackend & { debugStepCount?: () => number }) | null;
        count += backend?.debugStepCount?.() ?? 0;
      }
      return count;
    },
    update(seconds, physics, camera, aspect, useMotionCamera) {
      let cameraApplied = false;
      // Official viewer: physics only when enabled AND t > 0 (not seeking).
      // At t≈0 use physics:false so the next play frame is a "seeking" rebind.
      const wantPhysics = physics && physicsWanted;
      const physicsOn = wantPhysics && seconds > 1e-4;
      for (const entry of entries.values()) {
        if (!entry.visible) continue;

        // Parent root matrixWorld must be current: library calls
        // mesh.updateWorldMatrix(false, true) and will not refresh parents.
        // Scale is forced to 1 during physics so colliders match bone spaces.
        syncEntryWorldMatrix(entry, physicsOn);

        const prev = lastPhysicsSeconds.get(entry.id);
        const jumpedBack = prev !== undefined && seconds + 1e-4 < prev;
        const jumpedFar = prev !== undefined && seconds - prev > 0.25;
        if (physicsOn && (jumpedBack || jumpedFar || prev === undefined)) {
          try {
            entry.model.runtime.seek(seconds);
          } catch {
            // ignore
          }
        }

        const hasBodyMotion = entry.bodyAnimation != null;
        entry.model.update(seconds, { physics: physicsOn, ik: hasBodyMotion });
        if (physicsOn) {
          lastPhysicsSeconds.set(entry.id, seconds);
        } else if (!wantPhysics) {
          lastPhysicsSeconds.delete(entry.id);
        }

        // Face / manual morphs after skeleton + physics.
        applyMorphOverrides(entry);
        // Restore user scale for rendering (physics ran at unit scale).
        if (physicsOn) syncEntryWorldMatrix(entry, false);
        const materials = getMeshMaterials(entry.model.mesh);
        if (directionalLight) syncMmdSpecularDirection(materials, directionalLight);
        applyMaterialOverrides(entry, lightingContext());
        enforceModelCastOnlyShadows(entry.model.root);
        if (useMotionCamera && !cameraApplied && entry.hasCameraTrack) {
          const cameraState = entry.model.runtime.cameraState();
          if (cameraState) {
            applyMmdCameraStateToThreeCamera(camera, cameraState, { aspect });
            cameraApplied = true;
          }
        }
      }
    },
    dispose() {
      disposed = true;
      for (const id of [...entries.keys()]) removeEntry(id);
      lastPhysicsSeconds.clear();
      selectedId = null;
      duration = 0;
      hasCameraTrack = false;
      physicsWanted = false;
    },
  };
}
