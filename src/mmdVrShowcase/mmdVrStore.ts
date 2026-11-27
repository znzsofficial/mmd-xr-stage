import { create } from "zustand";
import { emptyAssetLoadProgress, type AssetLoadProgress } from "./stage/loading/mmdAssetLoadQueue";
import type { StageSnapshot } from "./stage/stageSnapshot";
import { LIGHT_ORDER, normalizeMmdVrPrefs, prefsStorage, type MmdVrPrefs } from './settings/preferences';
import { endMmdVrAssetSession, isWebgpuStageSession } from "./backpack/sessionAssets";
import { invalidateBackpackCommands, prepareBackpackEntry, useBackpack } from "./backpack/store";
import { resetMmdVrClock } from "./stage/mmdVrClock";
import { resetViewOnMenuSwitch } from "./scenery/catalog";
import {fitsWebgpuRoom,supportsWebgpuRoom} from './xr/floorBackend';
import { normalizeMmdVrModelScale } from "./settings/mmdVrAdjustments";

export { normalizeMmdVrHeightOffset, normalizeMmdVrModelScale } from "./settings/mmdVrAdjustments";

// Keep existing store imports working; the settings module owns the schema.
export type { MmdVrPrefs, MmdVrRenderQuality, MmdVrDprPref, MmdVrFrameRatePref, MmdVrAntialiasPref,
  MmdVrTogglePref, MmdVrWalkSpeedPref, MmdVrLightPreset, MmdVrShadowResolutionPref, MmdVrSnapTurnDegrees,
  MmdVrColliderFriction, MmdVrColliderRestitution } from './settings/preferences';
export { normalizeMmdVrExposure, normalizeMmdVrFrameRate, normalizeMmdVrPrefs, normalizeMmdVrSnapTurnDegrees,
  MMD_VR_PREFS_KEY, MMD_VR_PREFS_LEGACY_KEY } from './settings/preferences';

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
  getWardrobe?: (id:string,file:File)=>import('./wardrobe/model').WardrobeModel|null;
  invalidateWardrobe?: ()=>void;
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

type MmdVrStore = {
  savedStage: StageSnapshot | null;
  resumeStage: StageSnapshot | null;
  captureStage: (() => StageSnapshot | null) | null;
  setStageCapture: (capture: (() => StageSnapshot | null) | null) => void;
  prepareStage: (resume: boolean) => void;
  entryEpoch: number;
  entryStartedAt: number | null;
  assetLoad: AssetLoadProgress;
  setAssetLoad: (progress: AssetLoadProgress) => void;
  assetRetryEpoch: number;
  retryFailedAssets: () => void;
  prefs: MmdVrPrefs;
  setPrefs: (patch: Partial<MmdVrPrefs>, options?: { preserveViewOnCrossing: true }) => void;
  phase: MmdVrSessionPhase;
  errorMessage: string | null;
  lastError: string | null;
  setLastError: (value: string | null) => void;
  setPhase: (phase: MmdVrSessionPhase, errorMessage?: string | null) => void;
  overlayOpen: boolean;
  presentation: 'xr' | 'screen';
  openOverlay: (presentation?: 'xr' | 'screen') => void;
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
  cyclePhysicsHapticLevel: () => void;
  cyclePhysicsColliderRadius: () => void;
  cyclePhysicsColliderFriction: () => void;
  cyclePhysicsColliderRestitution: () => void;
  physicsResetEpoch: number;
  requestPhysicsReset: () => void;
  physicsBusy: boolean;
  physicsSwitchWork?:import('./diagnostics/physicsSwitchWork').PhysicsSwitchWork;
  setPhysicsBusy: (busy: boolean,work?:import('./diagnostics/physicsSwitchWork').PhysicsSwitchWork) => void;
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

function sessionReset() {
  resetMmdVrClock();
  return {
    assetLoad: emptyAssetLoadProgress(),
    assetRetryEpoch: 0,
    playing: false,
    statusLine: null as string | null,
    physicsError: null as string | null,
    physicsFatal: false,
    physicsEnabled: false,
    physicsDebugEnabled: false,
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
    pendingModelTransforms: [] as { id: string; scale?: number; rotationY?: number; reset?: boolean }[],
    duration: 0,
    seekEpoch: 0,
    seekSeconds: 0,
  };
}

const initialPrefs = prefsStorage.read();

// During a fresh request the old multi-room layout is still the committed one.
// The new room may neither load it nor replace it with a pre-presentation capture.
export function awaitingFreshXrFrame(s: Pick<MmdVrStore, 'presentation'|'phase'|'resumeStage'>) {
  return s.presentation === 'xr' && s.phase === 'entering' && s.resumeStage === null;
}

export const useMmdVrStore = create<MmdVrStore>((set, get) => ({
  savedStage: null,
  resumeStage: null,
  captureStage: null,
  setStageCapture: (captureStage) => set({ captureStage }),
  prepareStage: (resume) => {
    const saved = resume ? get().savedStage : null;
    if (saved?.scenery && saved.scenery !== get().prefs.scenery) get().setPrefs({ scenery: saved.scenery });
    set({ resumeStage: saved, physicsEnabled: saved?.physicsEnabled ?? false });
  },
  assetLoad: emptyAssetLoadProgress(),
  setAssetLoad: (assetLoad) => set({ assetLoad }),
  assetRetryEpoch: 0,
  retryFailedAssets: () => {
    const { assetLoad, physicsBusy } = get();
    if (assetLoad.running || !assetLoad.failures.length || physicsBusy) return;
    set((state) => ({ assetRetryEpoch: state.assetRetryEpoch + 1, assetLoad: { ...state.assetLoad, running: true } }));
  },
  prefs: initialPrefs,
  setPrefs: (patch, options) => {
    if (isWebgpuStageSession() && patch.scenery && (!supportsWebgpuRoom(patch.scenery) || !fitsWebgpuRoom(useBackpack.getState().layouts[patch.scenery]))) return;
    const previousRoom = get().prefs.scenery;
    const prefs = normalizeMmdVrPrefs({ ...get().prefs, ...patch });
    prefsStorage.write(prefs);
    const leaveDistrict = !options?.preserveViewOnCrossing && (resetViewOnMenuSwitch(previousRoom, prefs.scenery) || (isWebgpuStageSession() && previousRoom!==prefs.scenery));
    set({ prefs, loop: prefs.loop, ...(leaveDistrict ? {viewEpoch:get().viewEpoch+1} : {}) });
  },
  cyclePhysicsColliderRadius: () => {
    const radii = [0.04, 0.08, 0.12, 0.16];
    const cur = get().prefs.physicsColliderRadius;
    get().setPrefs({ physicsColliderRadius: radii[(radii.indexOf(cur) + 1) % radii.length] });
  },
  cyclePhysicsColliderFriction: () => {
    const cur = get().prefs.physicsColliderFriction;
    get().setPrefs({ physicsColliderFriction: cur === "low" ? "medium" : cur === "medium" ? "high" : "low" });
  },
  cyclePhysicsColliderRestitution: () => {
    const cur = get().prefs.physicsColliderRestitution;
    get().setPrefs({ physicsColliderRestitution: cur === "none" ? "low" : cur === "low" ? "high" : "none" });
  },
  entryEpoch: 0,
  entryStartedAt: null,
  phase: "idle",
  errorMessage: null,
  lastError: null,
  setLastError: (lastError) => set({ lastError }),
  setPhase: (phase, errorMessage = null) => set({ phase, errorMessage }),
  overlayOpen: false,
  presentation: 'xr',
  openOverlay: (presentation = 'xr') => set((state) => ({
    presentation,
    entryEpoch: state.entryEpoch + 1,
    entryStartedAt: performance.now(),
    assetLoad: emptyAssetLoadProgress(),
    assetRetryEpoch: 0,
    overlayOpen: true,
    errorMessage: null,
    lastError: null,
    physicsDebugEnabled: presentation==='xr' && state.prefs.detailedPhysicsDiagnostics,
  })),
  closeOverlay: () => {
    const current = get();
    // A partial restore must never replace the last complete stage.
    const bag = useBackpack.getState();
    const complete = !bag.busy && !current.assetLoad.running && current.assetLoad.failures.length === 0 && !current.physicsBusy && !current.physicsFatal;
    const savedStage = awaitingFreshXrFrame(current) ? current.savedStage :
      (complete ? current.captureStage?.() : null) ?? bag.layouts[current.prefs.scenery] ?? current.savedStage;
    invalidateBackpackCommands();
    endMmdVrAssetSession();
    set({
      savedStage,
      captureStage: null,
      resumeStage: null,
      entryEpoch: get().entryEpoch + 1,
      overlayOpen: false,
      phase: "idle",
      errorMessage: null,
      ...sessionReset(),
      assetLoad: { ...get().assetLoad, running: false },
    });
  },
  failEnter: (errorMessage = "enter_failed") => {
    invalidateBackpackCommands();
    endMmdVrAssetSession();
    set({
      entryEpoch: get().entryEpoch + 1,
      overlayOpen: false,
      phase: "error",
      errorMessage,
      lastError: errorMessage,
      ...sessionReset(),
    });
  },
  markEntered: () => {
    const state = get();
    if (!state.overlayOpen) return;
    const fresh = awaitingFreshXrFrame(state);
    if (fresh) prepareBackpackEntry(false);
    set({lastError:null, errorMessage:null, phase:'active', ...(fresh && {savedStage:null})});
  },
  playing: false,
  setPlaying: (playing) => set({ playing }),
  loop: initialPrefs.loop,
  setLoop: (loop) => get().setPrefs({ loop }),
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
  setPhysicsBusy: (physicsBusy,physicsSwitchWork) => set({ physicsBusy,physicsSwitchWork }),
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
  setModels: (models) => set({ models, modelCount: models.length }),
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
  setObjects: (objects) => set({ objects }),
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
