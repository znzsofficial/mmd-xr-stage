import { create } from "zustand";
import { createLocalPrefsStorage } from "../shared/localPrefs";
import {
  normalizeImmersiveAntialias,
  normalizeImmersiveDpr,
  normalizeImmersiveFramebufferScale,
  normalizeImmersiveFoveation,
  normalizeImmersiveQuality,
  normalizeImmersiveToggle,
  type ImmersiveAntialiasPref,
  type ImmersiveDprPref,
  type ImmersiveFramebufferScalePref,
  type ImmersiveFoveationPref,
  type ImmersiveRenderQuality,
  type ImmersiveTogglePref,
} from "../xr";
import { endMmdVrAssetSession } from "./mmdVrAssets";
import { resetMmdVrClock } from "./mmdVrClock";
import type { MmdPhysicsQuality } from "./mmdPhysicsQuality";
import type { MmdVrHapticLevel } from "./mmdVrHaptics";
import { normalizeMmdVrHeightOffset, normalizeMmdVrModelScale, normalizeMmdVrViewDistance } from "./mmdVrAdjustments";

export { normalizeMmdVrHeightOffset, normalizeMmdVrModelScale } from "./mmdVrAdjustments";

export type MmdVrRenderQuality = ImmersiveRenderQuality;
export type MmdVrDprPref = ImmersiveDprPref;
export type MmdVrFrameRatePref = "auto" | "72" | "80" | "90" | "120";
export type MmdVrAntialiasPref = ImmersiveAntialiasPref;
export type MmdVrTogglePref = ImmersiveTogglePref;
export type MmdVrWalkSpeedPref = "auto" | "slow" | "normal" | "fast";
export type MmdVrLightPreset = "stage" | "soft" | "contrast" | "daylight" | "warm" | "rim";
export type MmdVrShadowResolutionPref = "auto" | "low" | "medium" | "high";
export type MmdVrSnapTurnDegrees = 15 | 30 | 45;

export type MmdVrBoneFeedback = "soft" | "normal" | "hard";
export type MmdVrColliderFriction = "low" | "medium" | "high";
export type MmdVrColliderRestitution = "none" | "low" | "high";

export type MmdVrSessionPhase = "idle" | "entering" | "active" | "error";

const EMPTY_STRING_ARRAY: readonly string[] = Object.freeze([]);
const EMPTY_TRANSFORM_ARRAY: readonly { id: string; scale?: number; rotationY?: number; reset?: boolean }[] = Object.freeze([]);

export type MmdVrModelEntry = {
  id: string;
  name: string;
  visible: boolean;
  scale: number;
  rotationY: number;
};

export type MmdVrMaterialState = {
  name: string;
  visible: boolean;
  opacity: number;
  roughness: number;
  metallic: number;
  emission: number;
};

export type MmdVrRuntimeRef = {
  setMaterialVisible: (modelId: string, materialName: string, visible: boolean) => void;
  setMaterialOverride: (modelId: string, materialName: string, patch: { opacity?: number; roughness?: number; metallic?: number; emission?: number }) => void;
};

export type MmdVrObjectEntry = {
  id: string;
  name: string;
  visible: boolean;
  scale: number;
  rotationY: number;
};

export type MmdVrPrefs = {
  renderQuality: MmdVrRenderQuality;
  showFps: boolean;
  loop: boolean;
  dprPref: MmdVrDprPref;
  frameRatePref: MmdVrFrameRatePref;
  antialiasPref: MmdVrAntialiasPref;
  shadowsPref: MmdVrTogglePref;
  gridPref: MmdVrTogglePref;
  walkSpeedPref: MmdVrWalkSpeedPref;
  lightPreset: MmdVrLightPreset;
  framebufferScalePref: ImmersiveFramebufferScalePref;
  foveationPref: ImmersiveFoveationPref;
  shadowResolutionPref: MmdVrShadowResolutionPref;
  heightOffset: number;
  viewDistance: number;
  snapTurnDegrees: MmdVrSnapTurnDegrees;
  exposure: number;
  stageSkyEnabled: boolean;
  stageFogEnabled: boolean;
  stageRimLightEnabled: boolean;
  stageLightPoolEnabled: boolean;
  /** Enables articulated hand rendering, interaction, and collision when available. */
  handTracking: boolean;
  advancedRenderOverrides: boolean;
  detailedPhysicsDiagnostics: boolean;
  panelFollowUser: boolean;
  physicsColliderRadius: number;
  physicsQuality: MmdPhysicsQuality;
  physicsBoneFeedback: MmdVrBoneFeedback;
  physicsColliderFriction: MmdVrColliderFriction;
  physicsColliderRestitution: MmdVrColliderRestitution;
  physicsHapticLevel: MmdVrHapticLevel;
  physicsDynamicSelfCollision: boolean;
};

export const MMD_VR_PREFS_KEY = "neko-virt-os.mmd-vr-showcase.v2";
export const MMD_VR_PREFS_LEGACY_KEY = "neko-virt-os.mmd-vr-showcase.v1";

type MmdVrStore = {
  prefs: MmdVrPrefs;
  setPrefs: (patch: Partial<MmdVrPrefs>) => void;
  setHeightOffsetTransient: (heightOffset: number) => void;
  phase: MmdVrSessionPhase;
  errorMessage: string | null;
  lastError: string | null;
  setLastError: (value: string | null) => void;
  setPhase: (phase: MmdVrSessionPhase, errorMessage?: string | null) => void;
  overlayOpen: boolean;
  openOverlay: () => void;
  closeOverlay: () => void;
  failEnter: (errorMessage?: string | null) => void;
  markEntered: () => void;
  playing: boolean;
  setPlaying: (playing: boolean) => void;
  loop: boolean;
  setLoop: (loop: boolean) => void;
  statusLine: string | null;
  setStatusLine: (line: string | null) => void;
  physicsError: string | null;
  physicsFatal: boolean;
  setPhysicsError: (message: string | null, fatal?: boolean) => void;
  physicsEnabled: boolean;
  setPhysicsEnabled: (enabled: boolean) => void;
  physicsDebugEnabled: boolean;
  setPhysicsDebugEnabled: (enabled: boolean) => void;
  physicsControllerCollisions: boolean;
  setPhysicsControllerCollisions: (enabled: boolean) => void;
  cyclePhysicsHapticLevel: () => void;
  cyclePhysicsColliderRadius: () => void;
  cyclePhysicsQuality: () => void;
  cyclePhysicsBoneFeedback: () => void;
  cyclePhysicsColliderFriction: () => void;
  cyclePhysicsColliderRestitution: () => void;
  physicsResetEpoch: number;
  requestPhysicsReset: () => void;
  physicsBusy: boolean;
  setPhysicsBusy: (busy: boolean) => void;
  physicsContactCount: number;
  setPhysicsContactCount: (count: number) => void;
  physicsControllerContactCounts: [number, number];
  setPhysicsControllerContactCounts: (counts: [number, number]) => void;
  physicsDynamicBodyCount: number;
  setPhysicsDynamicBodyCount: (count: number) => void;
  physicsRigidBodyCount: number;
  physicsStepCount: number;
  setPhysicsRuntimeStats: (rigidBodies: number, steps: number) => void;
  modelCount: number;
  models: MmdVrModelEntry[];
  setModels: (models: MmdVrModelEntry[]) => void;
  materialModels: Record<string, MmdVrMaterialState[]>;
  setMaterialModels: (materials: Record<string, MmdVrMaterialState[]>) => void;
  runtimeRef: MmdVrRuntimeRef | null;
  setRuntimeRef: (ref: MmdVrRuntimeRef | null) => void;
  setMaterialVisible: (modelId: string, materialName: string, visible: boolean) => void;
  setMaterialParam: (modelId: string, materialName: string, param: "opacity" | "roughness" | "metallic" | "emission", value: number) => void;
  materialPanelModelId: string | null;
  setMaterialPanelModelId: (id: string | null) => void;
  objects: MmdVrObjectEntry[];
  setObjects: (objects: MmdVrObjectEntry[]) => void;
  /** FIFO of model ids for stage to toggle visibility. */
  pendingVisibilityToggles: string[];
  enqueueVisibilityToggle: (id: string) => void;
  takeVisibilityToggles: () => string[];
  pendingModelRemovals: string[];
  enqueueModelRemoval: (id: string) => void;
  takeModelRemovals: () => string[];
  /** Ray-point ground place (M13). */
  placeMode: boolean;
  setPlaceMode: (on: boolean) => void;
  placeModelId: string | null;
  setPlaceModelId: (id: string | null) => void;
  pendingGroundPlace: { x: number; z: number } | null;
  requestGroundPlace: (x: number, z: number) => void;
  takeGroundPlace: () => { x: number; z: number } | null;
  pendingModelTransforms: { id: string; scale?: number; rotationY?: number; reset?: boolean }[];
  requestModelScale: (id: string, scale: number) => void;
  requestModelRotation: (id: string, rotationY: number) => void;
  requestModelReset: (id: string) => void;
  takeModelTransformRequests: () => { id: string; scale?: number; rotationY?: number; reset?: boolean }[];
  duration: number;
  setDuration: (n: number) => void;
  seekEpoch: number;
  seekSeconds: number;
  requestSeek: (seconds: number) => void;
  viewEpoch: number;
  resetView: () => void;
  cycleLightPreset: () => void;
};

const LIGHT_ORDER: MmdVrLightPreset[] = ["stage", "soft", "daylight", "warm", "rim", "contrast"];

function normalizeWalk(value: unknown): MmdVrWalkSpeedPref {
  if (value === "auto" || value === "slow" || value === "normal" || value === "fast") return value;
  return "auto";
}

function normalizeLight(value: unknown): MmdVrLightPreset {
  if (value === "stage" || value === "soft" || value === "contrast"
    || value === "daylight" || value === "warm" || value === "rim") return value;
  return "stage";
}

function normalizeShadowResolution(value: unknown): MmdVrShadowResolutionPref {
  if (value === "auto" || value === "low" || value === "medium" || value === "high") return value;
  return "auto";
}

export function normalizeMmdVrFrameRate(value: unknown): MmdVrFrameRatePref {
  if (value === "auto" || value === "72" || value === "80" || value === "90" || value === "120") return value;
  if (value === "low") return "72";
  if (value === "mid") return "90";
  if (value === "high") return "120";
  return "auto";
}

export function normalizeMmdVrSnapTurnDegrees(value: unknown): MmdVrSnapTurnDegrees {
  return value === 15 || value === 45 ? value : 30;
}

export function normalizeMmdVrExposure(value: unknown): number {
  const exposure = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.round(Math.min(1.3, Math.max(0.7, exposure)) * 10) / 10;
}

function normalizePhysicsQuality(value: unknown): MmdPhysicsQuality {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

function normalizePhysicsColliderRadius(value: unknown): number {
  const radius = typeof value === "number" && Number.isFinite(value) ? value : 0.08;
  return [0.04, 0.08, 0.12, 0.16].includes(radius) ? radius : 0.08;
}

function normalizeBoneFeedback(value: unknown): MmdVrBoneFeedback {
  if (value === "soft" || value === "normal" || value === "hard") return value;
  return "normal";
}

function normalizeColliderFriction(value: unknown): MmdVrColliderFriction {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "medium";
}

function normalizeColliderRestitution(value: unknown): MmdVrColliderRestitution {
  if (value === "none" || value === "low" || value === "high") return value;
  return "none";
}

function normalizeHapticLevel(value: unknown): MmdVrHapticLevel {
  if (value === "off" || value === "low" || value === "normal") return value;
  return "low";
}

export function normalizeMmdVrPrefs(parsed: Partial<MmdVrPrefs> = {}): MmdVrPrefs {
  const lightPreset = normalizeLight(parsed.lightPreset);
  const legacyPresetEffectsEnabled = lightPreset !== "stage";
  return {
    renderQuality: normalizeImmersiveQuality(parsed.renderQuality),
    showFps: Boolean(parsed.showFps),
    loop: parsed.loop !== false,
    dprPref: normalizeImmersiveDpr(parsed.dprPref),
    frameRatePref: normalizeMmdVrFrameRate(parsed.frameRatePref),
    antialiasPref: normalizeImmersiveAntialias(parsed.antialiasPref),
    shadowsPref: normalizeImmersiveToggle(parsed.shadowsPref),
    gridPref: normalizeImmersiveToggle(parsed.gridPref),
    walkSpeedPref: normalizeWalk(parsed.walkSpeedPref),
    lightPreset,
    framebufferScalePref: normalizeImmersiveFramebufferScale(parsed.framebufferScalePref),
    foveationPref: normalizeImmersiveFoveation(parsed.foveationPref),
    shadowResolutionPref: normalizeShadowResolution(parsed.shadowResolutionPref),
    heightOffset: normalizeMmdVrHeightOffset(parsed.heightOffset),
    viewDistance: normalizeMmdVrViewDistance(parsed.viewDistance),
    snapTurnDegrees: normalizeMmdVrSnapTurnDegrees(parsed.snapTurnDegrees),
    exposure: normalizeMmdVrExposure(parsed.exposure),
    stageSkyEnabled: parsed.stageSkyEnabled !== false,
    stageFogEnabled: parsed.stageFogEnabled !== false,
    stageRimLightEnabled: typeof parsed.stageRimLightEnabled === "boolean"
      ? parsed.stageRimLightEnabled
      : legacyPresetEffectsEnabled,
    stageLightPoolEnabled: typeof parsed.stageLightPoolEnabled === "boolean"
      ? parsed.stageLightPoolEnabled
      : legacyPresetEffectsEnabled,
    handTracking: parsed.handTracking !== false,
    advancedRenderOverrides: Boolean(parsed.advancedRenderOverrides),
    detailedPhysicsDiagnostics: Boolean(parsed.detailedPhysicsDiagnostics),
    panelFollowUser: parsed.panelFollowUser !== false,
    physicsColliderRadius: normalizePhysicsColliderRadius(parsed.physicsColliderRadius),
    physicsQuality: normalizePhysicsQuality(parsed.physicsQuality),
    physicsBoneFeedback: normalizeBoneFeedback(parsed.physicsBoneFeedback),
    physicsColliderFriction: normalizeColliderFriction(parsed.physicsColliderFriction),
    physicsColliderRestitution: normalizeColliderRestitution(parsed.physicsColliderRestitution),
    physicsHapticLevel: normalizeHapticLevel(parsed.physicsHapticLevel),
    physicsDynamicSelfCollision: Boolean(parsed.physicsDynamicSelfCollision),
  };
}

const prefsStorage = createLocalPrefsStorage<MmdVrPrefs>({
  key: MMD_VR_PREFS_KEY,
  legacyKey: MMD_VR_PREFS_LEGACY_KEY,
  defaults: () => ({
    renderQuality: "balanced",
    showFps: false,
    loop: true,
    dprPref: "auto",
    frameRatePref: "auto",
    antialiasPref: "auto",
    shadowsPref: "auto",
    gridPref: "auto",
    walkSpeedPref: "auto",
    lightPreset: "stage",
    framebufferScalePref: "auto",
    foveationPref: "auto",
    shadowResolutionPref: "auto",
    heightOffset: 0,
    viewDistance: 40,
    snapTurnDegrees: 30,
    exposure: 1,
    stageSkyEnabled: true,
    stageFogEnabled: true,
    stageRimLightEnabled: false,
    stageLightPoolEnabled: false,
    handTracking: true,
    advancedRenderOverrides: false,
    detailedPhysicsDiagnostics: false,
    panelFollowUser: true,
    physicsColliderRadius: 0.08,
    physicsQuality: "medium" as MmdPhysicsQuality,
    physicsBoneFeedback: "normal" as MmdVrBoneFeedback,
    physicsColliderFriction: "medium" as MmdVrColliderFriction,
    physicsColliderRestitution: "none" as MmdVrColliderRestitution,
    physicsHapticLevel: "low" as MmdVrHapticLevel,
    physicsDynamicSelfCollision: false,
  }),
  normalize: normalizeMmdVrPrefs,
});

function sessionReset() {
  resetMmdVrClock();
  return {
    playing: false,
    statusLine: null as string | null,
    physicsError: null as string | null,
    physicsFatal: false,
    physicsEnabled: false,
    physicsDebugEnabled: false,
    physicsControllerCollisions: true,
    physicsResetEpoch: 0,
    physicsBusy: false,
    physicsContactCount: 0,
    physicsControllerContactCounts: [0, 0] as [number, number],
    physicsDynamicBodyCount: 0,
    physicsRigidBodyCount: 0,
    physicsStepCount: 0,
    modelCount: 0,
    models: [] as MmdVrModelEntry[],
    materialModels: {} as Record<string, MmdVrMaterialState[]>,
    runtimeRef: null as MmdVrRuntimeRef | null,
    materialPanelModelId: null as string | null,
    objects: [] as MmdVrObjectEntry[],
    pendingVisibilityToggles: [] as string[],
    pendingModelRemovals: [] as string[],
    placeMode: false,
    placeModelId: null as string | null,
    pendingGroundPlace: null as { x: number; z: number } | null,
    pendingModelTransforms: [] as { id: string; scale?: number; rotationY?: number; reset?: boolean }[],
    duration: 0,
    seekEpoch: 0,
    seekSeconds: 0,
  };
}

const initialPrefs = prefsStorage.read();

export const useMmdVrStore = create<MmdVrStore>((set, get) => ({
  prefs: initialPrefs,
  setPrefs: (patch) => {
    const prefs = { ...get().prefs, ...patch };
    if (patch.renderQuality != null) prefs.renderQuality = normalizeImmersiveQuality(patch.renderQuality);
    if (patch.dprPref != null) prefs.dprPref = normalizeImmersiveDpr(patch.dprPref);
    if (patch.frameRatePref != null) prefs.frameRatePref = normalizeMmdVrFrameRate(patch.frameRatePref);
    if (patch.antialiasPref != null) prefs.antialiasPref = normalizeImmersiveAntialias(patch.antialiasPref);
    if (patch.shadowsPref != null) prefs.shadowsPref = normalizeImmersiveToggle(patch.shadowsPref);
    if (patch.gridPref != null) prefs.gridPref = normalizeImmersiveToggle(patch.gridPref);
    if (patch.walkSpeedPref != null) prefs.walkSpeedPref = normalizeWalk(patch.walkSpeedPref);
    if (patch.lightPreset != null) prefs.lightPreset = normalizeLight(patch.lightPreset);
    if (patch.framebufferScalePref != null) prefs.framebufferScalePref = normalizeImmersiveFramebufferScale(patch.framebufferScalePref);
    if (patch.foveationPref != null) prefs.foveationPref = normalizeImmersiveFoveation(patch.foveationPref);
    if (patch.shadowResolutionPref != null) prefs.shadowResolutionPref = normalizeShadowResolution(patch.shadowResolutionPref);
    if (patch.heightOffset != null) prefs.heightOffset = normalizeMmdVrHeightOffset(patch.heightOffset);
    if (patch.viewDistance != null) prefs.viewDistance = normalizeMmdVrViewDistance(patch.viewDistance);
    if (patch.snapTurnDegrees != null) prefs.snapTurnDegrees = normalizeMmdVrSnapTurnDegrees(patch.snapTurnDegrees);
    if (patch.exposure != null) prefs.exposure = normalizeMmdVrExposure(patch.exposure);
    if (patch.stageSkyEnabled != null) prefs.stageSkyEnabled = Boolean(patch.stageSkyEnabled);
    if (patch.stageFogEnabled != null) prefs.stageFogEnabled = Boolean(patch.stageFogEnabled);
    if (patch.stageRimLightEnabled != null) prefs.stageRimLightEnabled = Boolean(patch.stageRimLightEnabled);
    if (patch.stageLightPoolEnabled != null) prefs.stageLightPoolEnabled = Boolean(patch.stageLightPoolEnabled);
    if (patch.handTracking != null) prefs.handTracking = Boolean(patch.handTracking);
    if (patch.advancedRenderOverrides != null) prefs.advancedRenderOverrides = Boolean(patch.advancedRenderOverrides);
    if (patch.detailedPhysicsDiagnostics != null) prefs.detailedPhysicsDiagnostics = Boolean(patch.detailedPhysicsDiagnostics);
    if (patch.panelFollowUser != null) prefs.panelFollowUser = Boolean(patch.panelFollowUser);
    if (patch.physicsColliderRadius != null) prefs.physicsColliderRadius = normalizePhysicsColliderRadius(patch.physicsColliderRadius);
    if (patch.physicsQuality != null) prefs.physicsQuality = normalizePhysicsQuality(patch.physicsQuality);
    if (patch.physicsBoneFeedback != null) prefs.physicsBoneFeedback = normalizeBoneFeedback(patch.physicsBoneFeedback);
    if (patch.physicsColliderFriction != null) prefs.physicsColliderFriction = normalizeColliderFriction(patch.physicsColliderFriction);
    if (patch.physicsColliderRestitution != null) prefs.physicsColliderRestitution = normalizeColliderRestitution(patch.physicsColliderRestitution);
    if (patch.physicsHapticLevel != null) prefs.physicsHapticLevel = normalizeHapticLevel(patch.physicsHapticLevel);
    if (patch.physicsDynamicSelfCollision != null) prefs.physicsDynamicSelfCollision = Boolean(patch.physicsDynamicSelfCollision);
    prefsStorage.write(prefs);
    set({ prefs, loop: prefs.loop });
  },
  cyclePhysicsColliderRadius: () => {
    const radii = [0.04, 0.08, 0.12, 0.16];
    const cur = get().prefs.physicsColliderRadius;
    get().setPrefs({ physicsColliderRadius: radii[(radii.indexOf(cur) + 1) % radii.length] });
  },
  cyclePhysicsQuality: () => {
    const cur = get().prefs.physicsQuality;
    get().setPrefs({ physicsQuality: cur === "low" ? "medium" : cur === "medium" ? "high" : "low" });
  },
  cyclePhysicsBoneFeedback: () => {
    const cur = get().prefs.physicsBoneFeedback;
    get().setPrefs({ physicsBoneFeedback: cur === "soft" ? "normal" : cur === "normal" ? "hard" : "soft" });
  },
  cyclePhysicsColliderFriction: () => {
    const cur = get().prefs.physicsColliderFriction;
    get().setPrefs({ physicsColliderFriction: cur === "low" ? "medium" : cur === "medium" ? "high" : "low" });
  },
  cyclePhysicsColliderRestitution: () => {
    const cur = get().prefs.physicsColliderRestitution;
    get().setPrefs({ physicsColliderRestitution: cur === "none" ? "low" : cur === "low" ? "high" : "none" });
  },
  setHeightOffsetTransient: (heightOffset) =>
    set((state) => ({
      prefs: { ...state.prefs, heightOffset: normalizeMmdVrHeightOffset(heightOffset) },
    })),
  phase: "idle",
  errorMessage: null,
  lastError: null,
  setLastError: (lastError) => set({ lastError }),
  setPhase: (phase, errorMessage = null) => set({ phase, errorMessage }),
  overlayOpen: false,
  openOverlay: () => set((state) => ({
    overlayOpen: true,
    errorMessage: null,
    lastError: null,
    physicsDebugEnabled: state.prefs.detailedPhysicsDiagnostics,
  })),
  closeOverlay: () => {
    endMmdVrAssetSession();
    set({
      overlayOpen: false,
      phase: "idle",
      errorMessage: null,
      ...sessionReset(),
    });
  },
  failEnter: (errorMessage = "enter_failed") => {
    endMmdVrAssetSession();
    set({
      overlayOpen: false,
      phase: "error",
      errorMessage,
      lastError: errorMessage,
      ...sessionReset(),
    });
  },
  markEntered: () =>
    set({
      lastError: null,
      overlayOpen: true,
      errorMessage: null,
      phase: "entering",
    }),
  playing: false,
  setPlaying: (playing) => set({ playing }),
  loop: initialPrefs.loop,
  setLoop: (loop) => {
    const prefs = { ...get().prefs, loop };
    prefsStorage.write(prefs);
    set({ loop, prefs });
  },
  statusLine: null,
  setStatusLine: (statusLine) => set({ statusLine }),
  physicsError: null,
  physicsFatal: false,
  setPhysicsError: (physicsError, physicsFatal = false) => set({ physicsError, physicsFatal }),
  physicsEnabled: false,
  setPhysicsEnabled: (physicsEnabled) => set(physicsEnabled
    ? { physicsEnabled }
    : { physicsEnabled, physicsControllerContactCounts: [0, 0] }),
  physicsDebugEnabled: false,
  setPhysicsDebugEnabled: (physicsDebugEnabled) => set(physicsDebugEnabled
    ? { physicsDebugEnabled }
    : {
        physicsDebugEnabled,
        physicsContactCount: 0,
        physicsControllerContactCounts: [0, 0],
        physicsDynamicBodyCount: 0,
        physicsRigidBodyCount: 0,
        physicsStepCount: 0,
      }),
  physicsControllerCollisions: true,
  setPhysicsControllerCollisions: (physicsControllerCollisions) => set(physicsControllerCollisions
    ? { physicsControllerCollisions }
    : { physicsControllerCollisions, physicsControllerContactCounts: [0, 0] }),
  cyclePhysicsHapticLevel: () => {
    const cur = get().prefs.physicsHapticLevel;
    const next = cur === "off" ? "low" : cur === "low" ? "normal" : "off";
    if (next === "off") {
      set({ physicsControllerContactCounts: [0, 0] });
    }
    get().setPrefs({ physicsHapticLevel: next });
  },
  physicsResetEpoch: 0,
  requestPhysicsReset: () => set((state) => ({ physicsResetEpoch: state.physicsResetEpoch + 1 })),
  physicsBusy: false,
  setPhysicsBusy: (physicsBusy) => set({ physicsBusy }),
  physicsContactCount: 0,
  setPhysicsContactCount: (physicsContactCount) => set({ physicsContactCount }),
  physicsControllerContactCounts: [0, 0],
  setPhysicsControllerContactCounts: (physicsControllerContactCounts) => set({ physicsControllerContactCounts }),
  physicsDynamicBodyCount: 0,
  setPhysicsDynamicBodyCount: (physicsDynamicBodyCount) => set({ physicsDynamicBodyCount }),
  physicsRigidBodyCount: 0,
  physicsStepCount: 0,
  setPhysicsRuntimeStats: (physicsRigidBodyCount, physicsStepCount) => set({ physicsRigidBodyCount, physicsStepCount }),
  modelCount: 0,
  models: [],
  materialModels: {},
  runtimeRef: null,
  materialPanelModelId: null,
  setModels: (models) =>
    set((s) => ({
      models,
      modelCount: models.length,
      placeModelId:
        s.placeModelId && (models.some((m) => m.id === s.placeModelId) || s.objects.some((o) => o.id === s.placeModelId))
          ? s.placeModelId
          : models[0]?.id ?? null,
    })),
  setMaterialModels: (materialModels) => set((state) => ({
    materialModels,
    materialPanelModelId: state.materialPanelModelId && materialModels[state.materialPanelModelId]
      ? state.materialPanelModelId
      : null,
  })),
  setRuntimeRef: (runtimeRef) => set({ runtimeRef }),
  setMaterialPanelModelId: (materialPanelModelId) => set({ materialPanelModelId }),
  setMaterialVisible: (modelId, materialName, visible) => {
    const state = get();
    state.runtimeRef?.setMaterialVisible(modelId, materialName, visible);
    const mats = state.materialModels[modelId];
    if (!mats) return;
    set({
      materialModels: {
        ...state.materialModels,
        [modelId]: mats.map((m) => m.name === materialName ? { ...m, visible } : m),
      },
    });
  },
  setMaterialParam: (modelId, materialName, param, value) => {
    const state = get();
    const finiteValue = Number.isFinite(value) ? value : 0;
    const normalizedValue = param === "emission"
      ? Math.min(2, Math.max(0, finiteValue))
      : Math.min(1, Math.max(0, finiteValue));
    state.runtimeRef?.setMaterialOverride(modelId, materialName, { [param]: normalizedValue });
    const mats = state.materialModels[modelId];
    if (!mats) return;
    set({
      materialModels: {
        ...state.materialModels,
        [modelId]: mats.map((m) => m.name === materialName ? { ...m, [param]: normalizedValue } : m),
      },
    });
  },
  objects: [],
  setObjects: (objects) =>
    set((s) => ({
      objects,
      placeModelId:
        s.placeModelId && (s.models.some((m) => m.id === s.placeModelId) || objects.some((o) => o.id === s.placeModelId))
          ? s.placeModelId
          : s.models[0]?.id ?? objects[0]?.id ?? null,
    })),
  pendingVisibilityToggles: [],
  enqueueVisibilityToggle: (id) =>
    set((s) => ({
      pendingVisibilityToggles: [...s.pendingVisibilityToggles, id],
    })),
  takeVisibilityToggles: () => {
    const list = get().pendingVisibilityToggles;
    if (!list.length) return EMPTY_STRING_ARRAY as string[];
    set({ pendingVisibilityToggles: [] });
    return list;
  },
  pendingModelRemovals: [],
  enqueueModelRemoval: (id) => set((state) => ({
    pendingModelRemovals: (state.models.some((model) => model.id === id) || state.objects.some((obj) => obj.id === id))
      ? [...new Set([...state.pendingModelRemovals, id])]
      : state.pendingModelRemovals,
  })),
  takeModelRemovals: () => {
    const list = get().pendingModelRemovals;
    if (!list.length) return EMPTY_STRING_ARRAY as string[];
    set({ pendingModelRemovals: [] });
    return list;
  },
  placeMode: false,
  setPlaceMode: (placeMode) => {
    const models = get().models;
    const objects = get().objects;
    const currentId = get().placeModelId;
    const currentValid = !!currentId && (models.some((m) => m.id === currentId) || objects.some((o) => o.id === currentId));
    const nextId = currentValid ? currentId : models[0]?.id ?? objects[0]?.id ?? null;
    set({ placeMode, placeModelId: placeMode ? nextId : get().placeModelId });
  },
  placeModelId: null,
  setPlaceModelId: (placeModelId) => set({ placeModelId }),
  pendingGroundPlace: null,
  requestGroundPlace: (x, z) => {
    if (!get().placeMode) return;
    const clampedX = Math.min(5.5, Math.max(-5.5, x));
    const clampedZ = Math.min(5.5, Math.max(-5.5, z));
    set({ pendingGroundPlace: { x: clampedX, z: clampedZ } });
  },
  takeGroundPlace: () => {
    const p = get().pendingGroundPlace;
    if (!p) return null;
    set({ pendingGroundPlace: null });
    return p;
  },
  pendingModelTransforms: [],
  requestModelScale: (id, scale) => {
    const normalized = normalizeMmdVrModelScale(scale);
    set((s) => {
      const previous = s.pendingModelTransforms.find((request) => request.id === id);
      return {
        models: s.models.map((model) => model.id === id ? { ...model, scale: normalized } : model),
        objects: s.objects.map((obj) => obj.id === id ? { ...obj, scale: normalized } : obj),
        pendingModelTransforms: [
          ...s.pendingModelTransforms.filter((request) => request.id !== id),
          { ...previous, id, scale: normalized },
        ],
      };
    });
  },
  requestModelRotation: (id, rotationY) => {
    const normalized = ((rotationY % 360) + 360) % 360;
    set((s) => {
      const previous = s.pendingModelTransforms.find((request) => request.id === id);
      return {
        models: s.models.map((model) => model.id === id ? { ...model, rotationY: normalized } : model),
        objects: s.objects.map((obj) => obj.id === id ? { ...obj, rotationY: normalized } : obj),
        pendingModelTransforms: [
          ...s.pendingModelTransforms.filter((request) => request.id !== id),
          { ...previous, id, rotationY: normalized },
        ],
      };
    });
  },
  requestModelReset: (id) => {
    set((s) => ({
      models: s.models.map((model) => model.id === id ? { ...model, scale: 1, rotationY: 0 } : model),
      objects: s.objects.map((obj) => obj.id === id ? { ...obj, scale: 1, rotationY: 0 } : obj),
      pendingModelTransforms: [
        ...s.pendingModelTransforms.filter((request) => request.id !== id),
        { id, reset: true },
      ],
    }));
  },
  takeModelTransformRequests: () => {
    const requests = get().pendingModelTransforms;
    if (!requests.length) return EMPTY_TRANSFORM_ARRAY as { id: string; scale?: number; rotationY?: number; reset?: boolean }[];
    set({ pendingModelTransforms: [] });
    return requests;
  },
  duration: 0,
  setDuration: (duration) => set({ duration }),
  seekEpoch: 0,
  seekSeconds: 0,
  requestSeek: (seconds) =>
    set((s) => ({
      seekEpoch: s.seekEpoch + 1,
      seekSeconds: Math.max(0, seconds),
    })),
  viewEpoch: 0,
  resetView: () => set((s) => ({ viewEpoch: s.viewEpoch + 1 })),
  cycleLightPreset: () => {
    const cur = get().prefs.lightPreset;
    const idx = LIGHT_ORDER.indexOf(cur);
    const next = LIGHT_ORDER[(idx + 1) % LIGHT_ORDER.length];
    get().setPrefs({ lightPreset: next });
  },
}));
