import {
  applyMmdCameraStateToThreeCamera,
  syncMmdSpecularDirection,
  ThreeMmdLoader,
  type MmdAnimation,
  type ThreeMmdAnimation,
  type ThreeMmdModel,
} from "@yohawing/three-mmd-loader";
import type { MmdPhysicsBackend } from "@yohawing/three-mmd-loader/physics";
import { DefaultMmdRuntime, MmdAnimRuntime } from "@yohawing/three-mmd-loader/runtime";
import * as THREE from "three";
import { placementLoaderProfile } from '../diagnostics/placementWork';
import {mountedModelBytePool, type ModelByteLease} from './mountedModelBytes';
import { PhysicsPoseDisplay } from "./physicsPoseDisplay";
import type { RoomActorBackend, RoomActorBinding } from './roomActorBackend';
import {
  bodyDisplay, clearPoseForRebind, presentEvaluatedPose, releaseRemovedPose, restoreHiddenPose,
  restorePoseBeforeFrame, seedEditedSkirt, type ActorDisplayEntry,
} from './actorPoseDisplay';
import {createPoseSolver,type PoseSolver} from '../pose/poseSolver';
import { PARK_Y } from "./colliderReentry";
import { configureActorPalms } from './actorPalms';
import { createWardrobeModel, resumeWardrobeModel, type WardrobeModel } from '../wardrobe/model';
import { restoreDraws, presentDraws } from '../wardrobe/draws';
import { prepareMilkOutlets, type SampleMilkOutlet } from '../bodyState/lactation/outlets';
import type { BodyProfile } from '../bodyState/data';
import type { BodySupport } from '../bodyState/store';
import {elapsed,type PhysicsSwitchWork} from '../diagnostics/physicsSwitchWork';
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
  cloneTransform,
  DEFAULT_MODEL_TRANSFORM,
  disposeLoadedModelObject,
  disposeModelObject,
  enableModelShadows,
  enforceModelCastOnlyShadows,
  extractMaterialNames,
  extractMorphNames,
  packMorphOverrides,
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
  work?: import('../diagnostics/placementWork').PlacementWork;
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
  beginPose: (id:string,seconds:number)=>PoseSolver|null;
  endPose: (id:string)=>void;
  requestSkirtRefit:(id:string)=>void;
  getModelSurface: (id:string) => Pick<ThreeMmdModel,'root'|'mesh'|'renderOrderMeshes'>|null;
  getBodySupport?: (id:string) => BodySupport|null;
  getWardrobe?: (id:string,file:File) => WardrobeModel|null;
  /** Query after display evaluation. False leaves both world-space outputs untouched. */
  sampleMilkOutlet?: (runtimeId:string,...args:Parameters<SampleMilkOutlet>)=>boolean;
  /** Returns true when a paused stage needs another display evaluation. */
  setBodyProfile?: (id:string,profile:BodyProfile|null)=>boolean;
  setModelVisible: (id: string, visible: boolean) => void;
  setModelTransform: (id: string, patch: Partial<MmdModelTransform>) => void;
  /** When true, update() will not overwrite root TRS from entry.transform (gizmo drag). */
  setModelGizmoLock: (id: string, locked: boolean) => void;
  loadMotion: (file: File, slot?: MmdMotionSlot, modelId?: string | null, isStale?: () => boolean, work?: import('../diagnostics/roomRestoreTiming').RestoreMotionWork) => Promise<void>;
  clearMotion: (modelId: string, slot: MmdMotionSlot) => void;
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

type RuntimeEntryWithPhysics = ActorDisplayEntry & {
  actorBinding?: RoomActorBinding;
  manualMorphs?: ReturnType<typeof packMorphOverrides>;
  manualRestBound?: boolean;
  modelBytes?: ModelByteLease;
  motionEpoch: Record<MmdMotionSlot, number>;
  bodyProfile?:BodyProfile|null;
  milkOutlet:SampleMilkOutlet;
  bindPose: Float64Array;
  createWorld: (display: PhysicsPoseDisplay,work?:PhysicsSwitchWork) => Promise<MmdPhysicsBackend>;
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

function bindNoMotion(entry: RuntimeEntryWithPhysics) {
  if (entry.physicsBackend) {
    restoreBindPose(entry);
    bindStaticMmdPhysicsRuntime(entry.model);
  } else {
    const evaluator = entry.model.runtime;
    evaluator.clearAnimation();
    // The native adapter stays attached to this mesh after its first VMD.
    // Consume its dirty rest-IK result before restoring the cold, unposed PMX.
    evaluator.resetPose();
    restoreBindPose(entry);
  }
}

// A freshly placed, physics-off actor normally has no bound clip. Bind the
// cold rig only while a manual input needs evaluation; restore its original
// PMX bind on release (ordinary native rest evaluation can include rest IK).
function prepareManualRest(entry: RuntimeEntryWithPhysics) {
  if (entry.editor || entry.physicsBackend || entry.appliedAnimation) return;
  if (entry.manualMorphs && !entry.manualRestBound) {
    restoreBindPose(entry);
    entry.model.setAnimation(STATIC_BINDING_ANIMATION);
    entry.manualRestBound = true;
  } else if (!entry.manualMorphs && entry.manualRestBound) {
    bindNoMotion(entry);
    entry.manualRestBound = false;
  }
}

function releaseEvaluator(evaluator: ThreeMmdModel['runtime']) {
  // The bundled WASM animation adapter owns native handles; the JS one does not.
  (evaluator as typeof evaluator & {dispose?:()=>void}).dispose?.();
}

const STATIC_BINDING_ANIMATION: MmdAnimation = {
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
  model.setAnimation(STATIC_BINDING_ANIMATION);
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
  actorBackend?: RoomActorBackend;
  /** Manual-pose, native-physics skirt display correction. False retains the raw display for comparisons. */
  poseSkirtClearance?:boolean;
  onSkirtWork?:import('./actorPoseDisplay').RecordSkirtWork;
  modelBytePool?: typeof mountedModelBytePool;
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
  /** No root requests the immutable slot layout; a stepping root selects its own wearable. */
  propColliders?: (steppingRoot?: THREE.Object3D | null) => readonly THREE.Matrix4[];
  propShape?: (slot: number, inverseScale: number, steppingRoot?: THREE.Object3D | null) => ReturnType<ColliderShapeFactory>;
  physicsQuality?: () => MmdPhysicsQuality;
  physicsDynamicSelfCollision?: () => boolean;
  prepareModel?: (root: THREE.Object3D) => void;
  prepareGpu?: (root: THREE.Object3D, stale: () => boolean, work?: MmdAddModelOptions['work']) => Promise<void>;
};

export function createMmdRuntimeHandle(scene: THREE.Scene, options: MmdRuntimeOptions = {}): MmdRuntimeHandle {
  const actorBackend = options.actorBackend;
  const palmsRequested=()=>typeof options.actorPalmCloth==='function'?options.actorPalmCloth():options.actorPalmCloth===true;
  let disposed = false;
  let membershipGeneration = 0;
  let clearGeneration = 0; // simultaneous adds are valid; a clear retires all pending adds
  const assertActive = () => {
    if (disposed) throw new DOMException("MMD runtime disposed", "AbortError");
  };
  const entries = new Map<string, RuntimeEntryWithPhysics>();
  const byteLeases = new Set<ModelByteLease>(); // includes loads not published to entries yet
  function releaseBytes(lease?: ModelByteLease) {
    if (lease) { lease.release(); byteLeases.delete(lease); }
  }
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

  function endPose(id:string){
    const entry=entries.get(id);if(!entry?.editor)return;
    const editor=entry.editor;entry.editor=undefined;
    clearPoseForRebind(entry);restoreDraws(entry.model.mesh);
    try{editor.restore();if(entry.physicsBackend&&!entry.appliedAnimation){restoreBindPose(entry);bindStaticMmdPhysicsRuntime(entry.model);}}
    finally{presentDraws(entry.model.mesh);}
    lastPhysicsSeconds.delete(id);
  }

  function commitMotion(entry: RuntimeEntryWithPhysics, slot: MmdMotionSlot, file: File | null, animation: ThreeMmdAnimation | null, work?: import('../diagnostics/roomRestoreTiming').RestoreMotionWork) {
    endPose(entry.id);
    const candidate = { ...entry, manualRestBound:false };
    candidate[`${slot}Animation`] = animation;
    candidate[`${slot}MotionName`] = file?.name ?? null;
    candidate[`${slot}MotionFile`] = file;
    clearPoseForRebind(entry);
    // A composed clip may allocate a fresh parsed-track evaluator, which
    // captures its rest transforms from the mesh at setAnimation time.
    restoreBindPose(entry);
    restoreDraws(entry.model.mesh);
    try {
      recomputeEntryAnimation(candidate, work);
      if (!candidate.appliedAnimation) bindNoMotion(entry);
    } catch (error) {
      restoreBindPose(entry);
      if (entry.appliedAnimation) entry.model.setAnimation(entry.appliedAnimation);
      else bindNoMotion(entry);
      throw error;
    } finally {
      presentDraws(entry.model.mesh);
      lastPhysicsSeconds.delete(entry.id);
    }
    Object.assign(entry, candidate);
    recomputeGlobal();
  }

  function removeEntry(id: string) {
    const entry = entries.get(id);
    if (!entry) return;
    releaseBytes(entry.modelBytes);
    endPose(id);scene.remove(entry.model.root);
    releaseRemovedPose(entry);
    disposeEntryPhysics(entry);
    entry.actorBinding?.dispose();
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
    const lease = (options.modelBytePool ?? mountedModelBytePool).acquire(modelFile);
    if (lease) byteLeases.add(lease);
    try { return await assembleEntry(modelFile, companionFiles, withPhysics, transform, preferredId, isStale, work, lease); }
    catch (error) { releaseBytes(lease); throw error; }
  }

  async function assembleEntry(
    modelFile: File, companionFiles: readonly File[], withPhysics: boolean, transform: MmdModelTransform,
    preferredId: string | undefined, isStale: () => boolean, work: MmdAddModelOptions['work'], modelBytes?: ModelByteLease,
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
      // A stowed tool (or the inactive XR input family) needs no inverse,
      // basis conversion or root update. Wrappers copy this immutable input.
      const parked=new Float32Array(new THREE.Matrix4().makeTranslation(0,PARK_Y,0).elements);
      const hiddenMatrices=colliderMatrices.map(()=>parked);
      const isParked=(m:THREE.Matrix4)=>m.elements[12]===0&&m.elements[13]===PARK_Y&&m.elements[14]===0;
      return () => {
        const root = colliderRoot;
        const worldMatrices = getWorldMatrices();
        if (!root || worldMatrices.length !== colliderMatrices.length) return [];
        if(getEnabled?.()===false||worldMatrices.every(isParked))return hiddenMatrices;
        root.updateWorldMatrix(true, false);
        unitRoot.copy(root.matrixWorld);
        const scale = Math.min(10, Math.max(0.01, Number(root.userData.mmdVisualScale) || 1));
        visualRoot.copy(unitRoot).scale(visualScale.setScalar(scale));
        inverseVisualRoot.copy(visualRoot).invert();
        worldToPhysics.multiplyMatrices(unitRoot, inverseVisualRoot);
        for (let index = 0; index < colliderMatrices.length; index += 1) {
          if (isParked(worldMatrices[index])) {
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
    const readProps = options.propColliders, shape = options.propShape;
    const propColliderProvider = createMappedColliderProvider(readProps ? () => readProps(colliderRoot) : undefined, undefined, readProps?.().length ?? 0);
    // One Bullet world per model (library world holds a single uploaded model identity).
    const physicsDisplay = withPhysics ? new PhysicsPoseDisplay() : undefined;
    let actorBinding: RoomActorBinding | undefined;
    const displayHands = {mask: 0, colliders: handColliders, radius: handColliderRadius};
    const createWorld = (display: PhysicsPoseDisplay,switchWork?:PhysicsSwitchWork) => createBulletPhysicsBackend({switchWork,
           // Ahead of all synthetic slots; the existing wrappers still own the
           // direct buffers, contact-index ranges and debug counters on rebind.
           actorStep: actorBackend ? (ctx, step) => actorBinding ? actorBinding.stepPhysics(ctx, step) : step(ctx) : undefined,
          controllerColliders: colliderProvider,
          controllerRadius: () => {
            const scale = Math.min(10, Math.max(0.01, Number(colliderRoot?.userData.mmdVisualScale) || transform.scale));
            return (controllerColliderRadius?.() ?? 0.08) / scale;
          },
           handColliders: handColliderProvider,
            onEligibleColliders:handColliderProvider ? mask=>{displayHands.mask=(mask >>> (colliderProvider?2:0)) & 0xfff;} : undefined,
           propColliders:propColliderProvider,
           propShape: shape ? (slot, inverseScale) => shape(slot, inverseScale, colliderRoot) : undefined,
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
      ...(actorBackend ? {geometryAwareAlpha:true} : {}),
      localPngAlphaTiles: options.alphaTiles?.forLoad(stale),
      performance: work ? placementLoaderProfile(work) : undefined,
      runtime: runtimeOptions,
      ...(withPhysics ? { runtimeFactory: () => new DefaultMmdRuntime(runtimeOptions) } : {}),
    });
    let model, bindPose, milkOutlet, materialNames;
    try {
      assertCurrent();
      const started = work ? performance.now() : 0;
      const source = modelBytes ? await modelBytes.read() : modelFile;
      assertCurrent();
      const readMs = modelBytes && work ? performance.now()-started : 0;
      model = await loader.loadModel(source, actorBackend?.loadOptions);
      if (work) {
        work.loaderWallMs = performance.now()-started;
        if (modelBytes) {
          const stages = work.loaderStagesMs ??= {};
          stages['read-bytes'] = readMs + (stages['read-bytes'] ?? 0);
        }
      }
      assertCurrent();
      bindPose = captureBindPose(model.mesh);
      milkOutlet = actorBackend?.prepareMilkOutlets
        ? await actorBackend.prepareMilkOutlets(model,stale,source instanceof Uint8Array?source:undefined)
        : await prepareMilkOutlets(model,stale);
      assertCurrent();
      configureActorPalms(model.mesh,palmsRequested());
      // Use the authored slot names. The renderer can append outline groups
      // and replace the dense mesh attributes during this synchronous attach.
      materialNames = extractMaterialNames(model);
      actorBinding = actorBackend?.attach(model,{file:modelFile,resolver:textureResolver,companionFiles,pmxBytes:source instanceof Uint8Array?source:undefined});
      if (withPhysics) bindStaticMmdPhysicsRuntime(model);
      colliderRoot = model.root;
      prepareModel?.(model.root);
    } catch (error) {
      actorBinding?.dispose();
      if (model) disposeLoadedModelObject(model);
      physicsBackend?.dispose?.();
      throw error;
    }

    if (!actorBinding) enableModelShadows(model);
    enforceModelCastOnlyShadows(model.root, {receiveOnly: !!actorBinding});

    const morphNames = extractMorphNames(model);
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
      motionEpoch: { body: 0, face: 0, camera: 0 },
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
      modelBytes,
      companionFiles: companionFiles.length ? [...companionFiles] : [modelFile],
      physicsBackend,
      actorBinding,
      physicsDisplay,
      bindPose, milkOutlet, createWorld, displayHands,
    };
    try {
      entry.wardrobe = resumeWardrobeModel(model.mesh,modelFile,model);
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
        await options.prepareGpu(model.root, stale, work);
      }
      assertCurrent();
    } catch (error) {
      disposeEntryPhysics(entry); actorBinding?.dispose(); disposeModelObject(entry); throw error;
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
    for(const id of entries.keys())endPose(id);
    const generation = membershipGeneration;
    const stale = () => disposed || generation !== membershipGeneration;
    const assertCurrent = () => { if (stale()) throw new DOMException('Stage changed', 'AbortError'); };
    const snapshots = [...entries.values()].map((entry) => ({
      id: entry.id,
      bodyAnimation: entry.bodyAnimation,
      bodyProfile: entry.bodyProfile,
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
        if(snap.bodyProfile){entry.bodyProfile=snap.bodyProfile;bodyDisplay(entry).configure(snap.bodyProfile);}
        entry.morphWeights = snap.morphWeights;
        entry.manualMorphs = packMorphOverrides(entry);
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
              const retained = entry.modelBytes;
              if (work) { const key = retained ? 'modelByteHits' : 'modelByteReads'; work[key] = (work[key] ?? 0) + 1; }
              const modelBytes = await (retained ? retained.read() : entry.modelFile.arrayBuffer().then(b => new Uint8Array(b))).finally(()=>elapsed(work,'readModelMs',read));
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
              entry.actorBinding?.interrupt();
              clearPoseForRebind(entry);
              restoreBindPose(entry);
              configureActorPalms(entry.model.mesh,palmsRequested());
              const animation = entry.appliedAnimation?.animation ?? (backend ? STATIC_BINDING_ANIMATION : null);
              if (animation) runtime.setAnimation(animation, entry.model.mesh);
              const old = entry.model.exchangeRuntime(runtime);
              entry.manualRestBound = false;
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
      for (const lease of byteLeases) releaseBytes(lease);
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
    getModelSurface(id) {return entries.get(id)?.model??null;},
    getWardrobe(id,file){const e=entries.get(id);return e?.visible&&e.modelFile===file?(e.wardrobe??=createWardrobeModel(e.model.mesh,file,e.model)):null;},
    sampleMilkOutlet(id,...args){const e=entries.get(id);return !!e?.visible&&e.milkOutlet(...args);},
    getBodySupport(id){const entry=entries.get(id);return entry?bodyDisplay(entry).support:null;},
    setBodyProfile(id,profile){
      const entry=entries.get(id);if(!entry||(!profile&&!entry.bodyDisplay))return false;
      entry.bodyProfile=profile; return bodyDisplay(entry).configure(profile);
    },
    beginPose(id,seconds){
      const entry=entries.get(id);if(!entry?.visible)return null;
      if(entry.editor)return entry.editor;
      entry.actorBinding?.interrupt();
      const original=entry.model.runtime;
      clearPoseForRebind(entry);restoreBindPose(entry);restoreDraws(entry.model.mesh);lastPhysicsSeconds.delete(id);
      try{
        entry.editor=createPoseSolver(entry.model,entry.appliedAnimation,seconds,!!entry.bodyAnimation);return entry.editor;
      }catch(error){
        // A malformed/custom skeleton cannot be edited. Leave its original
        // animation bound, even if the temporary evaluator had been installed.
        if(entry.model.runtime!==original)releaseEvaluator(entry.model.exchangeRuntime(original));
        restoreBindPose(entry);
        if(entry.appliedAnimation)entry.model.setAnimation(entry.appliedAnimation);
        else if(entry.physicsBackend)bindStaticMmdPhysicsRuntime(entry.model);
        entry.model.update(seconds,{physics:false,ik:!!entry.bodyAnimation,morphOverrides:entry.manualMorphs});
        console.warn('[mmdVr] Could not edit this skeleton',error);return null;
      }finally{presentDraws(entry.model.mesh);}
    },endPose,
    requestSkirtRefit(id){const entry=entries.get(id);
      if(entry?.editor&&entry.visible&&physicsWanted&&options.poseSkirtClearance!==false)entry.skirtRefitPending=true;
    },
    setModelVisible(id, visible) {
      const entry = entries.get(id);
      if (!entry) return;
      if (entry.visible !== visible) lastPhysicsSeconds.delete(id);
      if (!visible) { entry.actorBinding?.interrupt(); endPose(id); restoreHiddenPose(entry); }
      entry.visible = visible;
      applyMaterialVisibility(entry);
      applyMaterialOverrides(entry, lightingContext());
      refreshMaterialTextures(entry);
    },
    setModelTransform(id, patch) {
      const entry = entries.get(id);
      if (!entry) return;
      if ((Object.keys(patch) as (keyof MmdModelTransform)[]).some(k => patch[k] !== entry.transform[k])) {
        entry.physicsDisplay?.invalidate();
        entry.actorBinding?.reseed();
      }
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
      // The player's multiplier composes with the material's authored alpha.
      // Observe the actual visible layer, not just the slider value.
      const slot=patch.opacity===undefined?-1:entry.materialNames.indexOf(materialName);
      const mat=slot<0?undefined:getMeshMaterials(entry.model.mesh)[slot];
      const previousOpacity=mat?.opacity;
      entry.materialOverrides[materialName] = mergeMaterialOverride(entry.materialOverrides[materialName], patch);
      if (patch.opacity !== undefined){
        applyMaterialVisibility(entry);
        const next=mat?.opacity;
        // The contact layers use .04 for cloth/legs and .5 for a dressed
        // abdomen. Editing transparency within one band does not change fit.
        if(entry.editor&&entry.poseSkirt&&next!==undefined&&previousOpacity!==undefined&&
          ((next>=.04)!==(previousOpacity>=.04)||(next>=.5)!==(previousOpacity>=.5)))entry.skirtRefitPending=true;
      }
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
      actorBackend?.setLight(directionalLight);
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
      const epoch = ++entry.motionEpoch[slot];
      const at = work ? performance.now() : 0;
      const request = options.motionCache?.acquire(file, slot);
      if (work) {
        work.cache = request?.status ?? 'none';
        work.evaluator = entry.model.runtime instanceof MmdAnimRuntime ? 'wasm-adapter' : entry.model.runtime instanceof DefaultMmdRuntime ? 'js' : 'other';
      }
      let animation;
      try { animation = await (request?.promise ?? new ThreeMmdLoader().loadAnimation(file)); }
      finally { if (work) work.loadWallMs = performance.now() - at; }
      assertActive();
      if (entries.get(id) !== entry || epoch !== entry.motionEpoch[slot] || isStale?.()) throw new DOMException("MMD model changed", "AbortError");
      commitMotion(entry, slot, file, animation, work);
      request?.bound(animation);
    },
    clearMotion(modelId, slot) {
      assertActive();
      const entry = entries.get(modelId);
      if (!entry) throw new Error("Model not found");
      ++entry.motionEpoch[slot];
      if (entry[`${slot}Animation`]) commitMotion(entry, slot, null, null);
    },
    setMorphWeight(modelId, morphName, weight) {
      const entry = entries.get(modelId);
      if (!entry || !Number.isFinite(weight) || !Object.hasOwn(entry.model.mesh.morphTargetDictionary ?? {}, morphName)) return;
      const next = Math.min(1, Math.max(0, weight));
      if (next <= 0.001) {
        delete entry.morphWeights[morphName];
      } else {
        entry.morphWeights[morphName] = next;
      }
      entry.manualMorphs = packMorphOverrides(entry);
    },
    setMaterialVisible(modelId, materialName, visible) {
      const entry = entries.get(modelId);
      if (!entry) return;
      const changed=(entry.materialVisible[materialName]!==false)!==visible;
      entry.materialVisible[materialName] = visible;
      applyMaterialVisibility(entry);
      if(changed&&entry.editor&&entry.poseSkirt)entry.skirtRefitPending=true;
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
          entry.actorBinding?.reseed();
          clearPoseForRebind(entry);
          syncEntryWorldMatrix(entry, true);
          entry.physicsBackend.reset?.();
          entry.model.runtime.seek(t);
          restoreDraws(entry.model.mesh);
          try{entry.model.update(t, { physics: true, ik: !entry.editor&&entry.bodyAnimation != null, morphOverrides:entry.manualMorphs });}
          finally{presentDraws(entry.model.mesh);}
          // A reset seeds only the edited skirt, at visual scale.
          syncEntryWorldMatrix(entry, false);
          if (entry.editor && options.poseSkirtClearance !== false) seedEditedSkirt(entry,options.onSkirtWork);
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
        entry.actorBinding?.beforePose(physicsOn && !!entry.physicsBackend && !entry.editor);
        restorePoseBeforeFrame(entry, physicsOn, reset, reseed);
        prepareManualRest(entry);
        syncEntryWorldMatrix(entry, physicsOn);
        if (physicsOn && reset) {
          // seek() alone changes the loader clock but doesn't seed Bullet on a
          // forward scrub. Reset makes the next evaluated pose a seed-only step.
          entry.physicsBackend?.reset?.();
          entry.model.runtime.seek(seconds);
        }

        const hasBodyMotion = entry.bodyAnimation != null;
        entry.displayHands.mask = 0;
        stepDelta = physicsOn ? physicsDelta : undefined;
        restoreDraws(entry.model.mesh);
        try {
          entry.model.update(seconds, { physics: physicsOn, ik: !entry.editor&&hasBodyMotion, morphOverrides:entry.manualMorphs });
          if (physicsOn && physicsDelta != null) entry.physicsDisplay?.present(entry.model.mesh.skeleton.bones, physicsDelta,
            !hasBodyMotion && !entry.editor && !entry.gizmoLock);
        } finally {
          stepDelta = undefined;
          presentDraws(entry.model.mesh);
          if (physicsOn) syncEntryWorldMatrix(entry, false);
        }
        if (physicsOn) {
          lastPhysicsSeconds.set(entry.id, seconds);
        } else if (!wantPhysics) {
          lastPhysicsSeconds.delete(entry.id);
        }

        const dancePressure=(hasBodyMotion||!!entry.editor) && !!options.chestCompression?.();
        presentEvaluatedPose(entry, seconds, physicsDelta, prev, physicsOn, reseed || (physicsOn && reset), dancePressure,options.onSkirtWork);
        const materials = getMeshMaterials(entry.model.mesh);
        if (directionalLight) syncMmdSpecularDirection(materials, directionalLight);
        applyMaterialOverrides(entry, lightingContext());
        enforceModelCastOnlyShadows(entry.model.root, {receiveOnly: !!entry.actorBinding});
        entry.actorBinding?.afterPose(seconds, physicsDelta ?? 0, reset || reseed);
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
      for (const lease of byteLeases) releaseBytes(lease);
      for (const id of [...entries.keys()]) removeEntry(id);
      lastPhysicsSeconds.clear();
      selectedId = null;
      duration = 0;
      hasCameraTrack = false;
      physicsWanted = false;
    },
  };
}
