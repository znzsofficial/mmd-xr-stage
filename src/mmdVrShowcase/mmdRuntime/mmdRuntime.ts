import {
  applyMmdCameraStateToThreeCamera,
  syncMmdSpecularDirection,
  ThreeMmdLoader,
  type MmdAnimation,
  type ThreeMmdModel,
} from "@yohawing/three-mmd-loader";
import type { MmdPhysicsBackend } from "@yohawing/three-mmd-loader/physics";
import { DefaultMmdRuntime, MmdAnimRuntime } from "@yohawing/three-mmd-loader/runtime";
import * as THREE from "three";
import { placementLoaderProfile } from '../placementWork';
import { PhysicsPoseDisplay } from "./physicsPoseDisplay";
import { PARK_Y } from "./colliderReentry";
import { configureActorPalms } from './actorPalms';
import {fitChestCompression} from './chestCompression';
import {FINGERTIP_MASK,TrackedPressure} from './trackedPressure';
import {beginFingertipFit} from './fingertipIndent';
import {elapsed,type PhysicsSwitchWork} from '../physicsSwitchWork';
import { createLocalTextureResolver } from "./localTextureResolver";
export { createLocalTextureResolver } from "./localTextureResolver";
import { createBulletPhysicsBackend, type ColliderShapeFactory, type MmdPhysicsQuality } from "./mmdPhysics";
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
  work?: import('../placementWork').PlacementWork;
  isStale?: () => boolean;
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
  loadMotion: (file: File, slot?: MmdMotionSlot, modelId?: string | null, isStale?: () => boolean, work?: import('../roomRestoreTiming').RestoreMotionWork) => Promise<void>;
  setMorphWeight: (modelId: string, morphName: string, weight: number) => void;
  setMaterialVisible: (modelId: string, materialName: string, visible: boolean) => void;
  setMaterialOverride: (modelId: string, materialName: string, patch: Partial<MaterialOverride>) => void;
  setLighting: (options: {
    balancedModelColor?: boolean;
    envIntensity: number;
    ambientIntensity?: number;
    directionalLight: THREE.DirectionalLight | null;
    /** PMREM CubeUV from sky (WebGL toon IBL). */
    envMap?: THREE.Texture | null;
  }) => void;
  setPhysicsEnabled: (enabled: boolean,work?:PhysicsSwitchWork) => Promise<void>;
  rebuildPhysics: () => Promise<void>;
  /** Re-seed soft-body pose from current animation (fix floating / stuck cloth). */
  resetPhysics: (seconds?: number, modelId?: string) => void;
  getControllerContactCount: (controllerIndex?: number) => number;
  getRigidBodyCount: () => number;
  getDynamicRigidBodyCount: () => number;
  getPhysicsStepCount: () => number;
  update: (poseSeconds: number, physics: boolean, camera: THREE.PerspectiveCamera, aspect: number, useMotionCamera: boolean, physicsDelta?: number, reseed?: boolean) => void;
  dispose: () => void;
};

type RuntimeEntryWithPhysics = RuntimeEntry & {
  chest?:ReturnType<typeof fitChestCompression>;
  fingertipFit?:ReturnType<typeof beginFingertipFit>;
  fingertip?:ReturnType<ReturnType<typeof beginFingertipFit>>;
  handEligibility:{mask:number};
  trackedPressure?:TrackedPressure;
  bindPose: Float64Array;
  createWorld: (display: PhysicsPoseDisplay,work?:PhysicsSwitchWork) => Promise<MmdPhysicsBackend>;
  physicsDisplay?: PhysicsPoseDisplay;
  /** Dedicated Bullet world — do not share across models. */
  physicsBackend: MmdPhysicsBackend | null;
};

let nextModelSeq = 1;

// Capture local TRS before the first VMD/static binding. skeleton.pose() instead
// derives transforms from inverse bind matrices (including parent transforms).
function captureBindPose(mesh: THREE.SkinnedMesh) {
  const pose = new Float64Array(mesh.skeleton.bones.length * 10);
  mesh.skeleton.bones.forEach((bone, i) => {
    bone.position.toArray(pose, i*10); bone.quaternion.toArray(pose, i*10+3); bone.scale.toArray(pose, i*10+7);
  });
  return pose;
}

function restoreBindPose(entry: RuntimeEntryWithPhysics) {
  const {mesh,root} = entry.model;
  mesh.skeleton.bones.forEach((bone, i) => {
    bone.position.fromArray(entry.bindPose, i*10); bone.quaternion.fromArray(entry.bindPose, i*10+3); bone.scale.fromArray(entry.bindPose, i*10+7);
  });
  mesh.morphTargetInfluences?.fill(0);
  for (const body of mesh.userData.mmdMorphSplitBodyMeshes ?? []) body.morphTargetInfluences?.fill(0);
  root.updateMatrixWorld(true);
}

// Rebinding or reseeding discards display history; ordinary frames keep it.
function clearPoseForRebind(entry: RuntimeEntryWithPhysics) {
  entry.chest?.restore();
  entry.chest?.reset();
  entry.fingertip?.reset();
  entry.physicsDisplay?.restore(true);
}

function releaseEvaluator(evaluator: ThreeMmdModel['runtime']) {
  // The bundled WASM animation adapter owns native handles; the JS one does not.
  (evaluator as typeof evaluator & {dispose?:()=>void}).dispose?.();
}

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
  alphaTiles?: import('./roomAlphaTiles').RoomAlphaTiles;
  motionCache?: import('./roomMotionCache').RoomMotionCache;
  actorPalmCloth?:boolean|(()=>boolean);
  chestCompression?:()=>boolean;
  /** Cold reload reference path for parity checks and troubleshooting. */
  reusePhysicsModels?: boolean;
  /** For diagnostic consumers and the parity benchmark. The stage never reads loader.debugState(). */
  capturePhysicsStageSnapshots?:boolean;
  /** Legacy matrix schedule for equivalence probes. */
  coalescePhysicsWorldUpdates?:boolean;
  /** Per completed external-physics pose, not a GPU or pure Bullet solver timer. */
  onPhysicsPoseWork?: (animationIkMs:number, prepareMs:number, backendMs:number, writeBackMs:number)=>void;
  onBulletStepWork?: (feedMs:number,worldStepMs:number,outputsMs:number,seedOnly:boolean)=>void;
  controllerColliders?: () => readonly THREE.Matrix4[];
  controllerCollidersEnabled?: () => boolean;
  controllerColliderRadius?: () => number;
  controllerColliderFriction?: () => number;
  controllerColliderRestitution?: () => number;
  handColliders?: () => readonly THREE.Matrix4[];
  handCollidersEnabled?: () => boolean;
  handColliderRadius?: () => number;
  handShape?: ColliderShapeFactory;
  physicsQuality?: () => MmdPhysicsQuality;
  physicsDynamicSelfCollision?: () => boolean;
  prepareModel?: (root: THREE.Object3D) => void;
  prepareGpu?: (root: THREE.Object3D, stale: () => boolean, work?: MmdAddModelOptions['work']) => Promise<void>;
};

export function createMmdRuntimeHandle(scene: THREE.Scene, options: MmdRuntimeOptions = {}): MmdRuntimeHandle {
  const palmsRequested=()=>typeof options.actorPalmCloth==='function'?options.actorPalmCloth():options.actorPalmCloth===true;
  let disposed = false;
  let membershipGeneration = 0;
  let clearGeneration = 0; // simultaneous adds are valid; a clear retires all pending adds
  const assertActive = () => {
    if (disposed) throw new DOMException("MMD runtime disposed", "AbortError");
  };
  const entries = new Map<string, RuntimeEntryWithPhysics>();
  let selectedId: string | null = null;
  let physicsWanted = false;
  let physicsTransition: Promise<void> = Promise.resolve();
  /** Last evaluated timeline seconds per model (for seek / physics continuity). */
  const lastPhysicsSeconds = new Map<string, number>();
  let stepDelta: number | undefined;
  let duration = 0;
  let hasCameraTrack = false;
  let envIntensity = 0;
  let ambientIntensity = 0.55;
  let balancedModelColor = true;
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

  const externalRuntimeOptions = (physicsBackend: MmdPhysicsBackend) => ({
    physics: 'external' as const, physicsBackend,
    captureStageSnapshots: options.capturePhysicsStageSnapshots ?? false,
    coalescePhysicsWorldUpdates: options.coalescePhysicsWorldUpdates ?? true,
    onPhysicsPoseWork: options.onPhysicsPoseWork,
  });

  function lightingContext() {
    // Shared vectors — consumers copy into uniforms immediately.
    return {
      balancedModelColor,
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
    entry.fingertip?.reset();
    entry.fingertip=null;entry.fingertipFit=undefined;
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
    isStale: () => boolean = () => false,
    work?: MmdAddModelOptions['work'],
  ) {
    const stale = () => disposed || isStale();
    const assertCurrent = () => { if (stale()) throw new DOMException("Stage changed", "AbortError"); };
    assertCurrent();
    const textureResolver = createLocalTextureResolver(modelFile, companionFiles);
    let colliderRoot: THREE.Object3D | null = null;
    const unitRoot = new THREE.Matrix4();
    const inverseVisualRoot = new THREE.Matrix4();
    const mappedCollider = new THREE.Matrix4();
    const visualRoot = new THREE.Matrix4();
    const visualScale = new THREE.Vector3();
    const worldToPhysics = new THREE.Matrix4();
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
        worldToPhysics.multiplyMatrices(unitRoot, inverseVisualRoot);
        const enabled = getEnabled?.() !== false;
        for (let index = 0; index < colliderMatrices.length; index += 1) {
          const world = worldMatrices[index].elements;
          if (!enabled || (world[12] === 0 && world[13] === PARK_Y && world[14] === 0)) {
            mappedCollider.makeTranslation(0, PARK_Y, 0);
          } else {
            mappedCollider.multiplyMatrices(worldToPhysics, worldMatrices[index]);
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
    const physicsDisplay = withPhysics ? new PhysicsPoseDisplay() : undefined;
    const handEligibility={mask:0};
    const createWorld = (display: PhysicsPoseDisplay,switchWork?:PhysicsSwitchWork) => createBulletPhysicsBackend({switchWork,
          controllerColliders: colliderProvider,
          controllerRadius: () => {
            const scale = Math.min(10, Math.max(0.01, Number(colliderRoot?.userData.mmdVisualScale) || transform.scale));
            return (controllerColliderRadius?.() ?? 0.08) / scale;
          },
           handColliders: handColliderProvider,
           onEligibleColliders:handColliderProvider ? mask=>{handEligibility.mask=mask >>> (colliderProvider?2:0);} : undefined,
          handShape: options.handShape,
          simulationDelta: () => stepDelta,
          modelScale: () => Math.min(10, Math.max(0.01, Number(colliderRoot?.userData.mmdVisualScale) || transform.scale)),
          onPhysicsBones: display.record,
          onBulletStepWork: options.onBulletStepWork,
          handRadius: () => {
            const scale = Math.min(10, Math.max(0.01, Number(colliderRoot?.userData.mmdVisualScale) || transform.scale));
            return (handColliderRadius?.() ?? 0.035) / scale;
          },
          quality: physicsQuality,
          controllerFriction: options.controllerColliderFriction,
          controllerRestitution: options.controllerColliderRestitution,
          dynamicSelfCollision: physicsDynamicSelfCollision,
        });
    const physicsBackend = physicsDisplay ? await createWorld(physicsDisplay) : null;
    if (stale()) {
      physicsBackend?.dispose?.();
      assertCurrent();
    }
    const runtimeOptions = physicsBackend
      ? externalRuntimeOptions(physicsBackend)
      : { physics: "none" as const };

    const loader = new ThreeMmdLoader({
      textureResolver,
      localPngAlphaTiles: options.alphaTiles?.forLoad(stale),
      performance: work ? placementLoaderProfile(work) : undefined,
      runtime: runtimeOptions,
      ...(withPhysics ? { runtimeFactory: () => new DefaultMmdRuntime(runtimeOptions) } : {}),
    });
    let model, bindPose;
    try {
      assertCurrent();
      const started = work ? performance.now() : 0;
      model = await loader.loadModel(modelFile);
      if (work) work.loaderWallMs = performance.now()-started;
      assertCurrent();
      bindPose = captureBindPose(model.mesh);
      configureActorPalms(model.mesh,palmsRequested());
      if (withPhysics) bindStaticMmdPhysicsRuntime(model);
      colliderRoot = model.root;
      prepareModel?.(model.root);
    } catch (error) {
      if (model) disposeLoadedModelObject(model);
      physicsBackend?.dispose?.();
      throw error;
    }

    enableModelShadows(model);
    enforceModelCastOnlyShadows(model.root);

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
      physicsDisplay,
      bindPose, createWorld, handEligibility,
    };
    model.root.userData.mmdVisualScale = entry.transform.scale;
    // Tag root + meshes so post FX (DOF lock / selective bloom) can target a model id.
    model.root.userData.mmdModelId = id;
    model.root.traverse((object) => {
      object.userData.mmdModelId = id;
    });
    syncEntryWorldMatrix(entry);
    applyMaterialVisibility(entry);
    applyMaterialOverrides(entry, lightingContext());
    if (options.prepareGpu) {
      try {
        await options.prepareGpu(model.root, stale, work);
        assertCurrent();
      } catch (error) {
        disposeEntryPhysics(entry); disposeModelObject(entry); throw error;
      }
    }
    scene.add(model.root);
    entries.set(id, entry);
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

  async function rebuildAllModels(withPhysics: boolean, beforeRestore?: () => void,work?:PhysicsSwitchWork) {
    const generation = membershipGeneration;
    const stale = () => disposed || generation !== membershipGeneration;
    const assertCurrent = () => { if (stale()) throw new DOMException('Stage changed', 'AbortError'); };
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
        const { entry } = await createEntry(snap.modelFile, snap.companionFiles, physics, snap.transform, snap.id, stale);
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

    let touchedModels = false;
    try {
      if (options.reusePhysicsModels !== false) {
        // Prepare all worlds/evaluators off-scene. No GPU resources or live
        // rigs change while another actor or a WASM module is still loading.
        type Replacement = { entry: RuntimeEntryWithPhysics; runtime: ThreeMmdModel['runtime']; backend: MmdPhysicsBackend|null; display?: PhysicsPoseDisplay; installed?: boolean };
        const batch: Replacement[] = [];
        try {
          for (const entry of entries.values()) {
            assertCurrent();
            if (withPhysics) {
              const display = new PhysicsPoseDisplay();
              const backend = await entry.createWorld(display,work);
              const at=work?performance.now():0;
              try { batch.push({entry, display, backend, runtime: new DefaultMmdRuntime(externalRuntimeOptions(backend))}); }
              catch (error) { backend.dispose?.(); throw error; }
              finally {elapsed(work,'evaluatorMs',at);}
            } else {
              const read=work?performance.now():0;
              const modelBytes = new Uint8Array(await entry.modelFile.arrayBuffer().finally(()=>elapsed(work,'readModelMs',read)));
              assertCurrent();
              const at=work?performance.now():0;
              const runtime = await new ThreeMmdLoader({runtime:{physics:'none'}}).createDetachedRuntime({modelBytes,mesh:entry.model.mesh,source:entry.model.source}).finally(()=>elapsed(work,'evaluatorMs',at));
              batch.push({entry, backend:null, runtime});
            }
          }
          assertCurrent();
          // Synchronous commit: a renderer cannot see half of a batch. A bind
          // failure uses the known-good cold restore below, never a posed rig.
          touchedModels = true;
          const start=work?performance.now():0;
          try {
            for (const item of batch) {
              const {entry, runtime, backend, display} = item;
              clearPoseForRebind(entry);
              restoreBindPose(entry);
              configureActorPalms(entry.model.mesh,palmsRequested());
              const animation = entry.appliedAnimation?.animation ?? (backend ? STATIC_PHYSICS_BINDING_ANIMATION : null);
              if (animation) runtime.setAnimation(animation, entry.model.mesh);
              const old = entry.model.exchangeRuntime(runtime);
              disposeEntryPhysics(entry);
              entry.physicsBackend = backend; entry.physicsDisplay = display;
              item.installed = true;
              releaseEvaluator(old);
            }
          } finally { elapsed(work,'bindAndSwapMs',start); }
          lastPhysicsSeconds.clear();
          return;
        } finally {
          for (const item of batch) if (!item.installed) { releaseEvaluator(item.runtime); item.backend?.dispose?.(); }
        }
      }
      touchedModels = true;
      for (const id of [...entries.keys()]) removeEntry(id);
      lastPhysicsSeconds.clear();
      await restoreSnapshots(withPhysics);
    } catch (error) {
      beforeRestore?.();
      if (!touchedModels || stale()) throw error;
      for (const id of [...entries.keys()]) removeEntry(id);
      lastPhysicsSeconds.clear();
      try {
        const at=work?performance.now():0;await restoreSnapshots(previousPhysics).finally(()=>elapsed(work,'rollbackMs',at));
      } catch (restoreError) {
        if (stale()) throw restoreError;
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
      membershipGeneration++;
      clearGeneration++;
      for (const id of [...entries.keys()]) removeEntry(id);
      selectedId = null;
      duration = 0;
      hasCameraTrack = false;
    },
    async addModel(modelFile, companionFiles = [], options = {}) {
      membershipGeneration++;
      const generation = clearGeneration;
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
        () => generation !== clearGeneration || options.isStale?.() === true,
        options.work,
      );
      membershipGeneration++;
      selectedId = entry.id;
      recomputeGlobal();
      return report;
    },
    removeModel(id) {
      membershipGeneration++;
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
      if (entry.visible !== visible) lastPhysicsSeconds.delete(id);
      if (!visible) entry.fingertip?.reset();
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
      if (options.balancedModelColor !== undefined) balancedModelColor = options.balancedModelColor;
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
    async loadMotion(file, slot = "body", modelId = selectedId, isStale, work) {
      assertActive();
      const id = modelId ?? selectedId;
      if (!id) throw new Error("No model selected");
      const entry = entries.get(id);
      if (!entry) throw new Error("Model not found");
      if (work) {
        work.cache = options.motionCache?.status(file) ?? 'none';
        work.evaluator = entry.model.runtime instanceof MmdAnimRuntime ? 'wasm-adapter' : entry.model.runtime instanceof DefaultMmdRuntime ? 'js' : 'other';
      }
      const at = work ? performance.now() : 0;
      let animation;
      try { animation = await (options.motionCache?.load(file) ?? new ThreeMmdLoader().loadAnimation(file)); }
      finally { if (work) work.loadWallMs = performance.now() - at; }
      assertActive();
      if (entries.get(id) !== entry || isStale?.()) throw new DOMException("MMD model changed", "AbortError");
      // Validate/merge on a candidate. A malformed VMD (or failed bind) must
      // not change the exportable files, duration or the previous motion.
      const candidate = { ...entry };
      candidate[`${slot}Animation`] = animation;
      candidate[`${slot}MotionName`] = file.name;
      candidate[`${slot}MotionFile`] = file;
      clearPoseForRebind(entry);
      try {
        recomputeEntryAnimation(candidate, work);
      } catch (error) {
        if (entry.appliedAnimation) entry.model.setAnimation(entry.appliedAnimation);
        else if (entry.physicsBackend) bindStaticMmdPhysicsRuntime(entry.model);
        throw error;
      }
      Object.assign(entry, candidate);
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
    async setPhysicsEnabled(enabled,work) {
      const queued=work?performance.now():0;
      const transition = physicsTransition.then(async () => {
        elapsed(work,'waitForSlotMs',queued);
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
          await rebuildAllModels(enabled,undefined,work);
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
    resetPhysics(seconds, modelId) {
      if (!physicsWanted) return;
      const t = Number.isFinite(seconds) ? Math.max(0, seconds as number) : 0;
      // The next Bullet step seeds from this pose without integrating elapsed time.
      for (const entry of entries.values()) {
        if (modelId && entry.id !== modelId) continue;
        if (!entry.visible || !entry.physicsBackend || entry.physicsBackend.disposed) continue;
        try {
          clearPoseForRebind(entry);
          syncEntryWorldMatrix(entry, true);
          entry.physicsBackend.reset?.();
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
        if (!entry.visible || entry.physicsBackend?.disposed) continue;
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
    update(seconds, physics, camera, aspect, useMotionCamera, physicsDelta, reseed = false) {
      let cameraApplied = false;
      const wantPhysics = physics && physicsWanted;
      const physicsOn = wantPhysics && (physicsDelta !== undefined || seconds > 1e-4);
      if (reseed) lastPhysicsSeconds.clear();
      for (const entry of entries.values()) {
        if (!entry.visible) continue;

        // Parent root matrixWorld must be current: library calls
        // mesh.updateWorldMatrix(false, true) and will not refresh parents.
        // Scale is forced to 1 during physics so colliders match bone spaces.
        const prev = lastPhysicsSeconds.get(entry.id);
        const jumpedBack = prev !== undefined && seconds + 1e-4 < prev;
        const jumpedFar = prev !== undefined && seconds - prev > 0.25;
        const reset = jumpedBack || jumpedFar || prev === undefined;
        entry.chest?.restore();
        if (!physicsOn || reset || reseed) entry.fingertip?.reset();
        else entry.fingertip?.restore();
        entry.physicsDisplay?.restore(!physicsOn || reset);
        syncEntryWorldMatrix(entry, physicsOn);
        if (physicsOn && reset) {
          // seek() alone changes the loader clock but doesn't seed Bullet on a
          // forward scrub. Reset makes the next evaluated pose a seed-only step.
          entry.physicsBackend?.reset?.();
          entry.model.runtime.seek(seconds);
        }

        const hasBodyMotion = entry.bodyAnimation != null;
        entry.handEligibility.mask=0;
        stepDelta = physicsOn ? physicsDelta : undefined;
        try {
          entry.model.update(seconds, { physics: physicsOn, ik: hasBodyMotion });
          if (physicsOn && physicsDelta != null) entry.physicsDisplay?.present(entry.model.mesh.skeleton.bones, physicsDelta);
        } finally {
          stepDelta = undefined;
          if (physicsOn) syncEntryWorldMatrix(entry, false);
        }
        if (physicsOn) {
          lastPhysicsSeconds.set(entry.id, seconds);
        } else if (!wantPhysics) {
          lastPhysicsSeconds.delete(entry.id);
        }

        const dancePressure=hasBodyMotion && !!options.chestCompression?.();
        const handMask=physicsOn ? entry.handEligibility.mask : 0;
        // The authored pose and Bullet inputs are already complete.
        applyMorphOverrides(entry);
        // Continue the release even after all tracked slots disappeared. No
        // tracking history or contact query is needed in controller-only VR.
        if(dancePressure || handMask || (physicsOn && entry.trackedPressure)){
          if(entry.chest===undefined)entry.chest=fitChestCompression(entry.model.mesh);
          if(entry.chest && handMask && handColliders){
            entry.trackedPressure??=new TrackedPressure();
            entry.trackedPressure.prepare(handColliders(),handMask,handColliderRadius?.()??.033);
            if((handMask & FINGERTIP_MASK) && entry.fingertip===undefined){
              entry.fingertipFit??=beginFingertipFit(entry.model.mesh,entry.chest.affectedBones,entry.chest.width);
              entry.fingertip=entry.fingertipFit();
              if(entry.fingertip!==undefined)entry.fingertipFit=undefined;
            }
          }else if(entry.trackedPressure)entry.trackedPressure.mask=0;
          // Use the last surface sample to blend the broad response, then fit
          // this frame's dimple on the final display pose, including dance pressure.
          if(entry.chest?.apply(seconds,physicsDelta,reseed||(physicsOn&&reset),dancePressure,entry.trackedPressure,entry.fingertip?.tipBroadGain))entry.model.mesh.skeleton.update();
          if(physicsOn)entry.fingertip?.apply(entry.trackedPressure,physicsDelta??Math.max(0,seconds-(prev??seconds)));
        }else entry.chest?.reset();
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
