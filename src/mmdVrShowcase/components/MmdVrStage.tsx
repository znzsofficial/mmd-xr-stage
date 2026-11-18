import { useFrame, useThree } from "@react-three/fiber";
import { runtimeTiming } from "../runtimeTiming";
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef } from "react";
import * as THREE from "three";
import {
  createMmdRuntimeHandle,
  isMmdRuntimeRebuildError,
  type MmdRuntimeHandle,
} from "../mmdRuntime/mmdRuntime";
import { useLanguageStore } from "../../languageStore";
import { getMmdVrSessionAssets, type MmdVrAssetSlot } from "../mmdVrAssets";
import { invalidateBackpackCommands, useBackpack } from "../backpack";
import {
  clampMmdVrSimulationDelta,
  resetMmdVrClock,
  setMmdVrClockDuration,
  setMmdVrClockTime,
} from "../mmdVrClock";
import { getMmdVrRenderProfile } from "../mmdVrQuality";
import { PLACE_HALF_WIDTH, useMmdVrStore, type MmdVrLightPreset, type MmdVrMaterialState } from "../mmdVrStore";
import { objectHeadingDegrees, setObjectHeadingDegrees } from "../objectHeading";
import { LiveHouse } from "./LiveHouse";
import { prepareModelGpu } from "../prepareModelGpu";
import { DaylightSet, DaySky, SUN_POSITIONS } from "../scenery/DaylightSets";
import { showSceneryGrid, type SceneryId } from "../scenery/catalog";
import { canPlaceInScenery } from "../scenery/placementAreas";
import { useMmdVrTheme } from "../mmdVrTheme";
import { prepareMmdVrModel } from "../prepareMmdVrModel";
import { getMmdVrControllerColliderMatrices } from "../mmdVrControllerColliders";
import { getMmdVrHandColliderMatrices } from "../mmdVrHandColliders";
import { handContactShape, handReferenceRadius } from "../handContactProfile";
import {
  clearMmdVrHapticContacts,
  MMD_VR_HAPTIC_POLL_INTERVAL,
  setMmdVrHapticContacts,
} from "../mmdVrHaptics";
import { transformRequiresPhysicsReseed } from "../mmdVrPhysicsReseed";
import { createAssetLoadQueue, emptyAssetLoadProgress, type AssetLoadProgress } from "../mmdAssetLoadQueue";
import { restoreStageTime, type StageSnapshot } from "../stageSnapshot";
import { createStageActors } from "../stageActors";

const LIGHT_PRESETS: Record<
  MmdVrLightPreset,
  {
    ambient: number;
    ambientColor: string;
    sun: number;
    sunColor: string;
    hemi: number;
    hemiSky: string;
    hemiGround: string;
    sunPos: [number, number, number];
    skyZenith: string;
    skyHorizon: string;
    fogColor: string;
    floorColor: string;
    rimColor: string;
    rimIntensity: number;
    rimPosition: [number, number, number];
    poolColor: string;
  }
> = {
  stage: {
    ambient: 0.52,
    ambientColor: "#f0eeea",
    sun: 0.91,
    sunColor: "#fff9ef",
    hemi: 0.42,
    hemiSky: "#b8c8e0",
    hemiGround: "#1a2230",
    sunPos: [-3, 4.2, 4.8],
    skyZenith: "#1a2840",
    skyHorizon: "#0e1520",
    fogColor: "#0c1018",
    floorColor: "#1a2230",
    rimColor: "#6688bb",
    rimIntensity: 0,
    rimPosition: [0, 3.5, -3.5],
    poolColor: "#6688bb",
  },
  soft: {
    ambient: 0.75,
    ambientColor: "#f4efff",
    sun: 0.55,
    sunColor: "#fff5f0",
    hemi: 0.55,
    hemiSky: "#cedcf2",
    hemiGround: "#26313f",
    sunPos: [1.5, 5.5, 3.5],
    skyZenith: "#3a4060",
    skyHorizon: "#2a2c44",
    fogColor: "#282a46",
    floorColor: "#34344c",
    rimColor: "#a891cf",
    rimIntensity: 0.35,
    rimPosition: [0, 3.2, -3],
    poolColor: "#a891cf",
  },
  contrast: {
    ambient: 0.41,
    ambientColor: "#e4e9f2",
    sun: 1.03,
    sunColor: "#fff0e2",
    hemi: 0.36,
    hemiSky: "#9eb4d5",
    hemiGround: "#090d14",
    sunPos: [3.6, 3.8, 4.2],
    skyZenith: "#0a1018",
    skyHorizon: "#05080c",
    fogColor: "#0a0e15",
    floorColor: "#141a26",
    rimColor: "#5879bb",
    rimIntensity: 0.55,
    rimPosition: [0, 4.5, -4],
    poolColor: "#5879bb",
  },
  daylight: {
    ambient: 0.62,
    ambientColor: "#e8f2ff",
    sun: 1.18,
    sunColor: "#fffdf4",
    hemi: 0.52,
    hemiSky: "#b9dcf5",
    hemiGround: "#40515a",
    sunPos: [-3.5, 7.5, 4.5],
    skyZenith: "#4a86b8",
    skyHorizon: "#b7ccd8",
    fogColor: "#a3bccb",
    floorColor: "#5a6a76",
    rimColor: "#b9e7ff",
    rimIntensity: 0.2,
    rimPosition: [-2.5, 4, -3],
    poolColor: "#b9e7ff",
  },
  warm: {
    ambient: 0.42,
    ambientColor: "#ffd8c2",
    sun: 1.22,
    sunColor: "#ffb782",
    hemi: 0.3,
    hemiSky: "#a08aa0",
    hemiGround: "#3a2f38",
    sunPos: [4.8, 4.2, 3.6],
    skyZenith: "#5a4566",
    skyHorizon: "#9a6a70",
    fogColor: "#8a5f66",
    floorColor: "#4a3a42",
    rimColor: "#ff8dba",
    rimIntensity: 0.45,
    rimPosition: [-1.5, 3.5, -3.2],
    poolColor: "#ff8dba",
  },
  rim: {
    ambient: 0.3,
    ambientColor: "#d9e5ff",
    sun: 1.35,
    sunColor: "#8fe9ff",
    hemi: 0.28,
    hemiSky: "#86bcd1",
    hemiGround: "#151a26",
    sunPos: [-1.8, 5.2, -4.5],
    skyZenith: "#1a3246",
    skyHorizon: "#24384c",
    fogColor: "#1e3142",
    floorColor: "#26303f",
    rimColor: "#63eaff",
    rimIntensity: 1.1,
    rimPosition: [0, 3.8, -4.5],
    poolColor: "#63eaff",
  },
};

/** Inward-facing gradient dome (cheap sky, no HDR). Bottom blends into the fog color. */
function StageSky({ zenith, horizon, bottom }: { zenith: string; horizon: string; bottom: string }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 4;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, zenith);
      g.addColorStop(0.55, horizon);
      g.addColorStop(1, bottom);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 4, 64);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
    return map;
  }, [zenith, horizon, bottom]);

  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );

  return (
    <mesh scale={[-1, 1, 1]} renderOrder={-10}>
      <sphereGeometry args={[28, 24, 16]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} fog={false} />
    </mesh>
  );
}

function StageFloor({
  segments,
  shadows,
  placeMode,
  floorColor,
  deck,
}: {
  segments: number;
  shadows: boolean;
  placeMode: boolean;
  floorColor: string;
  deck: boolean;
}) {
  const { accent } = useMmdVrTheme();
  return (
    <group position={[0, -0.02, 0]}>
      {!deck && <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow={shadows}
        raycast={() => null}
      >
        <circleGeometry args={[8, segments]} />
        {shadows ? (
          <meshStandardMaterial color={floorColor} roughness={0.92} metalness={0.05} depthWrite={false} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        ) : (
          <meshBasicMaterial color={floorColor} depthWrite={false} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        )}
      </mesh>}
      {!deck && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[3.2, 3.32, Math.max(16, Math.floor(segments / 2))]} />
        <meshBasicMaterial color={accent.gridMajor} transparent opacity={0.4} side={THREE.FrontSide} />
      </mesh>}
      {placeMode ? (
        <mesh name="placement-surface" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.021, 0]}
          onPointerDown={e => { e.stopPropagation(); useMmdVrStore.getState().requestGroundPlace(e.point.x, e.point.z); }}>
          <planeGeometry args={[2 * PLACE_HALF_WIDTH, 2 * PLACE_HALF_WIDTH]} />
          <meshBasicMaterial color={accent.marker} transparent opacity={0.1} depthWrite={false} />
        </mesh>
      ) : null}
    </group>
  );
}

function StageLightPool({ color, opacity }: { color: string; opacity: number }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    if (context) {
      const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
      gradient.addColorStop(0, "#ffffff");
      gradient.addColorStop(0.22, "#ffffff");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, -0.35]}>
      <planeGeometry args={[5.4, 5.4]} />
      <meshBasicMaterial
        map={texture}
        color={color}
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

export function MmdVrStageContent() {
  const scenery = useMmdVrStore(s => s.prefs.scenery);
  // A→B→A may batch into a single React render. The old A's command and
  // loader closures must still retire, even though the final scenery is A.
  const [generation, advance] = useReducer(n => n + 1, 0);
  useLayoutEffect(() => useMmdVrStore.subscribe((s, prev) => { if (s.prefs.scenery !== prev.prefs.scenery) advance(); }), []);
  const initial = useRef({ scenery, saved: useMmdVrStore.getState().resumeStage, slots: getMmdVrSessionAssets() });
  const saved = useBackpack.getState().layouts[scenery] ?? (initial.current.scenery === scenery ? initial.current.saved : null);
  const slots = saved?.assets ?? (initial.current.scenery === scenery ? initial.current.slots : []);
  return <MmdVrStageRoom key={`${scenery}:${generation}`} scenery={scenery} saved={saved} slots={slots} />;
}

/** A single room owns a runtime: late restores and physics rebuilds can never target a new room's actors. */
export function MmdVrStageRoom({ scenery, saved, slots }: { scenery: SceneryId; saved: StageSnapshot | null; slots: readonly MmdVrAssetSlot[] }) {
  const { scene, camera, size, gl } = useThree();
  const { accent } = useMmdVrTheme();
  const mmdPrefs = useMmdVrStore((s) => s.prefs);
  const profile = getMmdVrRenderProfile(mmdPrefs);
  const lightPreset = mmdPrefs.lightPreset;
  const daySet = scenery === "classroom" || scenery === "pool" || scenery === "lawn" ? scenery : null;
  const baseLight = LIGHT_PRESETS[lightPreset] ?? LIGHT_PRESETS.stage;
  const lightCfg = useMemo(() => !daySet ? baseLight : ({ ...baseLight,
    sunPos: SUN_POSITIONS[daySet], hemiSky: "#d4e5ee", hemiGround: daySet === "lawn" ? "#72845a" : "#a79d8d",
    hemi: baseLight.hemi + 0.32, fogColor: lightPreset === "warm" ? "#e7c8a7" : "#c5dfe6",
  }), [daySet, baseLight, lightPreset]);
  const rimIntensity = lightCfg.rimIntensity > 0 ? lightCfg.rimIntensity : 0.28;
  const viewDistance = mmdPrefs.viewDistance;
  const shadowExtent = profile.quality === "high" ? 6 : profile.quality === "balanced" ? 5 : 4;
  const shadowFar = profile.quality === "high" ? 24 : profile.quality === "balanced" ? 20 : 16;
  const setPlaying = useMmdVrStore((s) => s.setPlaying);
  const setModels = useMmdVrStore((s) => s.setModels);
  const setMaterialModels = useMmdVrStore((s) => s.setMaterialModels);
  const setRuntimeRef = useMmdVrStore((s) => s.setRuntimeRef);
  const setObjects = useMmdVrStore((s) => s.setObjects);
  const setDuration = useMmdVrStore((s) => s.setDuration);
  const setStatusLine = useMmdVrStore((s) => s.setStatusLine);
  const seekEpoch = useMmdVrStore((s) => s.seekEpoch);
  const seekSeconds = useMmdVrStore((s) => s.seekSeconds);
  const language = useLanguageStore((s) => s.language);

  const runtimeRef = useRef<MmdRuntimeHandle | null>(null);
  const lastEvaluatedTimeRef = useRef(-Infinity);
  const timeRef = useRef(0);
  const staticSettleElapsed = useRef(0);
  const pendingSeekSeed = useRef(false);
  const physicsContactPollRef = useRef(0);
  const hapticContactPollRef = useRef(0);
  const lastPhysicsResetEpochRef = useRef(0);
  const playingRef = useRef(false);
  const loopRef = useRef(false);
  const loadGenRef = useRef(0);
  const loadQueueRef = useRef<ReturnType<typeof createAssetLoadQueue> | null>(null);
  const assetRetryEpoch = useMmdVrStore((s) => s.assetRetryEpoch);
  const initialAssets = useRef({ saved, slots });
  const initialLoad = useRef(true);
  const restoreFailures = useRef<AssetLoadProgress["failures"]>([]);
  const readyToSaveRef = useRef(false);
  const retired = useRef(false);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const stopPlayingQueuedRef = useRef(false);
  const lastSeekEpochRef = useRef(0);
  const lightingKeyRef = useRef("");
  const lifecycleGenerationRef = useRef(0);
  const physicsOperationCountRef = useRef(0);
  const appliedPhysicsEnabledRef = useRef(saved?.physicsEnabled ?? useMmdVrStore.getState().physicsEnabled);
  const appliedSelfCollisionRef = useRef(useMmdVrStore.getState().prefs.physicsDynamicSelfCollision);
  const labelsRef = useRef({
    loading: "Loading…",
    failed: "Load failed",
    empty: "No model",
    physicsRestored: "Physics failed; previous state restored",
    physicsFatal: "Physics recovery failed; exit and enter again",
  });
  const placeMode = useMmdVrStore((s) => s.placeMode);
  const physicsEnabled = useMmdVrStore((s) => s.physicsEnabled);
  const physicsBusy = useMmdVrStore(s => s.physicsBusy);
  const assetLoading = useMmdVrStore(s => s.assetLoad.running);
  const command = useBackpack(s => s.command);
  const waitForLoad = !physicsBusy && (assetLoading || !!command);
  const physicsDynamicSelfCollision = useMmdVrStore((s) => s.prefs.physicsDynamicSelfCollision);
  const setPhysicsBusy = useMmdVrStore((s) => s.setPhysicsBusy);

  // Keep labels current without re-running the load effect on language change.
  useEffect(() => {
    const t = useLanguageStore.getState().t;
    labelsRef.current = {
      loading: t("settingsMmdVrLoading"),
      failed: t("settingsMmdVrLoadFailed"),
      empty: t("settingsMmdVrEmptyNoAssets"),
      physicsRestored: t("settingsMmdVrPhysicsFailedRestored"),
      physicsFatal: t("settingsMmdVrPhysicsRecoveryFailed"),
    };
  }, [language]);

  useEffect(() => {
    playingRef.current = useMmdVrStore.getState().playing;
    loopRef.current = useMmdVrStore.getState().loop;
    return useMmdVrStore.subscribe((state) => {
      playingRef.current = state.playing;
      loopRef.current = state.loop;
    });
  }, []);

  useEffect(() => clearMmdVrHapticContacts, []);

  function saveRoom(): StageSnapshot | null {
    const s = useMmdVrStore.getState();
    if (!readyToSaveRef.current || s.physicsBusy || s.physicsFatal || s.assetLoad.running || s.assetLoad.failures.length) return null;
    const snapshot = { ...actors.capture(), scenery, time: timeRef.current, playing: s.playing, loop: s.loop,
      physicsEnabled: s.physicsEnabled, controllerCollisions: s.physicsControllerCollisions };
    useBackpack.setState(b => {
      const ids = new Map(b.entries.map(e => [e.file, e.id]));
      const stored = { ...b.stored }, bindings = { ...b.bindings };
      for (const item of [...snapshot.models, ...snapshot.objects]) {
        const id = ids.get(item.file);
        if (id) stored[id] = item;
      }
      for (const slot of snapshot.assets) if (slot.kind === "model") {
        const id = ids.get(slot.modelFile);
        if (id) bindings[id] = { body: slot.bodyMotionFile ?? undefined, face: slot.faceMotionFile ?? undefined };
      }
      return { layouts: { ...b.layouts, [scenery]: snapshot }, stored, bindings };
    });
    return snapshot;
  }
  function captureStage() {
    return retired.current ? useBackpack.getState().layouts[useMmdVrStore.getState().prefs.scenery] ?? null : saveRoom();
  }

  const runtime = useMemo(() => {
    const handle = createMmdRuntimeHandle(scene, {
      controllerColliders: getMmdVrControllerColliderMatrices,
      controllerCollidersEnabled: () => useMmdVrStore.getState().physicsControllerCollisions,
      controllerColliderRadius: () => useMmdVrStore.getState().prefs.physicsColliderRadius,
      handColliders: getMmdVrHandColliderMatrices,
      handCollidersEnabled: () => useMmdVrStore.getState().physicsControllerCollisions,
      handColliderRadius: () => handReferenceRadius(useMmdVrStore.getState().prefs.physicsColliderRadius),
      handShape: handContactShape,
      physicsQuality: () => useMmdVrStore.getState().prefs.physicsQuality,
      physicsDynamicSelfCollision: () => useMmdVrStore.getState().prefs.physicsDynamicSelfCollision,
      physicsBoneFeedbackScale: () => {
        const map = { soft: 0.35, normal: 1, hard: 1.8 } as const;
        return map[useMmdVrStore.getState().prefs.physicsBoneFeedback];
      },
      controllerColliderFriction: () => {
        const map = { low: 0.2, medium: 0.5, high: 0.9 } as const;
        return map[useMmdVrStore.getState().prefs.physicsColliderFriction];
      },
      controllerColliderRestitution: () => {
        const map = { none: 0, low: 0.25, high: 0.55 } as const;
        return map[useMmdVrStore.getState().prefs.physicsColliderRestitution];
      },
      prepareModel: prepareMmdVrModel,
      prepareGpu: (root, stale) => prepareModelGpu(gl, scene, camera, root, stale),
    });
    return handle;
  }, [scene, gl]);
  const actors = useMemo(() => createStageActors(scene, runtime, () => useMmdVrStore.getState().physicsEnabled, () => timeRef.current), [scene, runtime]);
  const isRoomStale = () => retired.current || !useMmdVrStore.getState().overlayOpen || useMmdVrStore.getState().prefs.scenery !== scenery || runtimeRef.current !== runtime;

  useLayoutEffect(() => {
    runtimeRef.current = runtime;
    const { saved } = initialAssets.current;
    useMmdVrStore.setState({
      physicsEnabled: appliedPhysicsEnabledRef.current,
      ...(saved ? { physicsControllerCollisions: saved.controllerCollisions, loop: saved.loop } : {}),
      physicsBusy: false, physicsError: null, physicsFatal: false, playing: false,
      models: [], modelCount: 0, objects: [], materialModels: {}, materialPanelModelId: null,
      placeMode: false, placeModelId: null, pendingGroundPlace: null, pendingModelTransforms: [],
      pendingVisibilityToggles: [], pendingModelRemovals: [], duration: 0, assetLoad: emptyAssetLoadProgress(),
    });
    resetMmdVrClock();
    return () => { runtimeRef.current = null; };
  }, [runtime]);

  useLayoutEffect(() => {
    useMmdVrStore.getState().setStageCapture(captureStage);
    const unsubscribe = useMmdVrStore.subscribe((s, previous) => {
      if (previous.overlayOpen && !s.overlayOpen) {
        // closeOverlay has captured the room already; late async work cannot republish it.
        retired.current = true;
        invalidateBackpackCommands();
        useBackpack.getState().publishLive({});
        return;
      }
      if (previous.overlayOpen && previous.prefs.scenery === scenery && previous.prefs.scenery !== s.prefs.scenery) {
        saveRoom();
        retired.current = true;
        invalidateBackpackCommands();
        useBackpack.getState().publishLive({});
      }
    });
    return () => {
      unsubscribe();
      if (useMmdVrStore.getState().captureStage === captureStage) {
        useMmdVrStore.getState().setStageCapture(null);
        invalidateBackpackCommands();
        useBackpack.getState().publishLive({});
      }
    };
  }, [runtime]);

  useEffect(() => {
    const handle = runtimeRef.current;
    if (!handle) return;
    setRuntimeRef({
      setMaterialVisible: (modelId, materialName, visible) => handle.setMaterialVisible(modelId, materialName, visible),
      setMaterialOverride: (modelId, materialName, patch) => handle.setMaterialOverride(modelId, materialName, patch),
    });
    return () => setRuntimeRef(null);
  }, [runtime, setRuntimeRef]);

  useEffect(() => {
    if (waitForLoad || physicsEnabled !== useMmdVrStore.getState().physicsEnabled || physicsEnabled === appliedPhysicsEnabledRef.current) return;
    let cancelled = false;
    captureStage(); // Last complete copy while a rebuild temporarily owns the models.
    setPhysicsBusy(true);
    useMmdVrStore.getState().setPhysicsError(null);
    physicsOperationCountRef.current += 1;
    void runtime.setPhysicsEnabled(physicsEnabled).then(() => {
      if (!cancelled && !isRoomStale()) {
        appliedPhysicsEnabledRef.current = physicsEnabled;
        if (physicsEnabled) {
          appliedSelfCollisionRef.current = useMmdVrStore.getState().prefs.physicsDynamicSelfCollision;
        }
        syncModelList();
        syncMaterialModels();
        lastEvaluatedTimeRef.current = -Infinity;
      }
    }).catch((error) => {
      if (!cancelled && !isRoomStale()) {
        console.error("[mmdVr] physics toggle failed", error);
        const fatal = isMmdRuntimeRebuildError(error);
        if (fatal) readyToSaveRef.current = false;
        syncModelList();
        syncMaterialModels();
        lastEvaluatedTimeRef.current = -Infinity;
        const store = useMmdVrStore.getState();
        if (fatal) appliedPhysicsEnabledRef.current = false;
        store.setPhysicsEnabled(fatal ? false : appliedPhysicsEnabledRef.current);
        store.setPhysicsError(fatal ? labelsRef.current.physicsFatal : labelsRef.current.physicsRestored, fatal);
        if (fatal) store.setPlaying(false);
      }
    }).finally(() => {
      physicsOperationCountRef.current = Math.max(0, physicsOperationCountRef.current - 1);
      if (!isRoomStale() && physicsOperationCountRef.current === 0) setPhysicsBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [physicsEnabled, runtime, setPhysicsBusy, waitForLoad]);

  useEffect(() => {
    if (waitForLoad || !useMmdVrStore.getState().physicsEnabled) return;
    if (physicsDynamicSelfCollision === appliedSelfCollisionRef.current) return;
    let cancelled = false;
    captureStage();
    setPhysicsBusy(true);
    useMmdVrStore.getState().setPhysicsError(null);
    physicsOperationCountRef.current += 1;
    void runtime.rebuildPhysics().then(() => {
      if (!cancelled && !isRoomStale()) {
        appliedSelfCollisionRef.current = physicsDynamicSelfCollision;
        syncModelList();
        syncMaterialModels();
        lastEvaluatedTimeRef.current = -Infinity;
      }
    }).catch((error) => {
      if (!cancelled && !isRoomStale()) {
        console.error("[mmdVr] self-collision rebuild failed", error);
        const fatal = isMmdRuntimeRebuildError(error);
        if (fatal) readyToSaveRef.current = false;
        syncModelList();
        syncMaterialModels();
        lastEvaluatedTimeRef.current = -Infinity;
        const store = useMmdVrStore.getState();
        store.setPrefs({ physicsDynamicSelfCollision: appliedSelfCollisionRef.current });
        store.setPhysicsError(fatal ? labelsRef.current.physicsFatal : labelsRef.current.physicsRestored, fatal);
        if (fatal) {
          store.setPlaying(false);
          appliedPhysicsEnabledRef.current = false;
          store.setPhysicsEnabled(false);
        }
      }
    }).finally(() => {
      physicsOperationCountRef.current = Math.max(0, physicsOperationCountRef.current - 1);
      if (!isRoomStale() && physicsOperationCountRef.current === 0) setPhysicsBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [physicsDynamicSelfCollision, runtime, setPhysicsBusy, waitForLoad]);

  useEffect(() => {
    const generation = ++lifecycleGenerationRef.current;
    return () => {
      queueMicrotask(() => {
        if (lifecycleGenerationRef.current !== generation) return;
        try {
          runtime.dispose();
        } catch {
          // ignore
        }
        actors.disposeObjects();
        if (runtimeRef.current === runtime) runtimeRef.current = null;
        loadQueueRef.current = null;
      });
    };
  }, [runtime]);

  function applyLighting() {
    const sun = sunRef.current;
    if (!sun) return;
    const key = `${scenery}|${lightPreset}|${profile.shadows}|${sun.uuid}`;
    if (lightingKeyRef.current === key) return;
    lightingKeyRef.current = key;
    const cfg = lightCfg;
    sun.position.set(...cfg.sunPos);
    sun.intensity = cfg.sun;
    sun.color.set(cfg.sunColor);
    sun.castShadow = getMmdVrRenderProfile(useMmdVrStore.getState().prefs).shadows;
    runtime.setLighting({
      envIntensity: 0,
      ambientIntensity: cfg.ambient,
      directionalLight: sun,
      envMap: null,
    });
  }

  useLayoutEffect(() => {
    lightingKeyRef.current = "";
    applyLighting();
  }, [runtime, lightCfg, profile.shadows]);

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    camera.far = viewDistance;
    camera.updateProjectionMatrix();
  }, [camera, viewDistance]);

  useLayoutEffect(() => {
    const previousToneMapping = gl.toneMapping;
    const previousExposure = gl.toneMappingExposure;
    return () => {
      gl.toneMapping = previousToneMapping;
      gl.toneMappingExposure = previousExposure;
    };
  }, [gl]);

  useLayoutEffect(() => {
    gl.toneMapping = mmdPrefs.softHighlights ? THREE.NeutralToneMapping : THREE.LinearToneMapping;
    gl.toneMappingExposure = mmdPrefs.exposure;
  }, [gl, mmdPrefs.softHighlights, mmdPrefs.exposure]);

  function syncModelList() {
    const list = runtime.listModels().map((m) => ({
      id: m.id,
      name: m.name,
      visible: m.visible,
      scale: m.transform.scale,
      rotationY: m.transform.rotationY,
    }));
    setModels(list);
    setDuration(runtime.duration);
    setMmdVrClockDuration(runtime.duration);
    actors.publishLive();
  }

  function syncMaterialModels() {
    const assets = runtime.exportProjectModels();
    const materialModels: Record<string, MmdVrMaterialState[]> = {};
    for (const model of assets) {
      const materialNames = Object.keys(model.materialOverrides);
      const materials: MmdVrMaterialState[] = materialNames.map((name: string) => {
        const override = model.materialOverrides[name];
        return {
          name,
          visible: model.materialVisible[name] !== false,
          opacity: override?.opacity ?? 1,
          roughness: override?.roughness ?? 0.55,
          metallic: override?.metallic ?? 0,
          emission: Math.min(2, Math.max(0, override?.emission ?? 0)),
        };
      });
      materialModels[model.id] = materials;
    }
    setMaterialModels(materialModels);
  }

  function syncObjects() {
    const list = [...actors.objects.entries()].map(([id, entry]) => ({
      id,
      name: entry.name,
      visible: entry.group.visible,
      scale: entry.group.scale.x,
      rotationY: objectHeadingDegrees(entry.group),
    }));
    setObjects(list);
  }

  // Preserve ordinary decode failures while adding/removing a particular
  // actor's repair ticket. A warning lets the actor render, but isn't a clean save.
  function updateProgress(progress: AssetLoadProgress, restoring = false) {
    if (restoring) restoreFailures.current = progress.failures;
    const failures = [...restoreFailures.current, ...actors.repairFailures()];
    useMmdVrStore.getState().setAssetLoad({ ...progress, failures });
    const prefix = `${labelsRef.current.loading} ${progress.completed + 1}/${progress.total}`;
    setStatusLine(progress.running ? `${prefix} · ${progress.fileName}` : failures.length ? `${labelsRef.current.failed} (${failures.length})` : null);
  }

  useEffect(() => {
    if (seekEpoch === lastSeekEpochRef.current) return;
    lastSeekEpochRef.current = seekEpoch;
    const dur = runtime.duration;
    timeRef.current = dur > 0 ? Math.min(Math.max(0, seekSeconds), dur) : 0;
    pendingSeekSeed.current = true;
    setMmdVrClockTime(timeRef.current, true);
  }, [seekEpoch, seekSeconds, runtime]);

  // Load once per runtime + session asset key (not on i18n change).
  useEffect(() => {
    const { saved, slots } = initialAssets.current;
    const repairs = actors.repairTasks(isRoomStale);
    if (!slots.length && !repairs.length) {
      readyToSaveRef.current = true;
      initialLoad.current = false;
      useMmdVrStore.getState().setAssetLoad(emptyAssetLoadProgress());
      setStatusLine(labelsRef.current.empty);
      setModels([]);
      setMaterialModels({});
      setObjects([]);
      setDuration(0);
      resetMmdVrClock();
      actors.publishLive();
      saveRoom();
      return;
    }

    const gen = ++loadGenRef.current;
    let cancelled = false;
    const isStale = () => cancelled || gen !== loadGenRef.current || isRoomStale();
    if (!loadQueueRef.current) {
      loadQueueRef.current = createAssetLoadQueue(actors.restoreTasks(slots, saved, isRoomStale));
    }
    setStatusLine(labelsRef.current.loading);
    queueMicrotask(() => void (async () => {
      if (isStale()) return;
      try {
        if (slots.length) await loadQueueRef.current!.run(progress => updateProgress(progress, true), isStale);
        if (!isStale() && repairs.length) {
          await createAssetLoadQueue(repairs).run(progress => updateProgress(progress), isStale);
          if (!isStale() && !actors.repairFailures().length) useBackpack.getState().dismissError();
        }
        if (isStale()) return;
        if (initialLoad.current) {
          timeRef.current = restoreStageTime(saved?.time ?? 0, runtime.duration);
          if (saved) {
            useMmdVrStore.getState().setLoop(saved.loop);
          }
        }
        // Force an evaluation on the next frame so static models (no motion,
        // no physics) are posed/bound after the async load finishes.
        lastEvaluatedTimeRef.current = -Infinity;
        syncModelList();
        syncMaterialModels();
        syncObjects();
        setMmdVrClockTime(timeRef.current, true);
        readyToSaveRef.current = true;
        if (initialLoad.current && runtime.duration > 0) setPlaying(saved?.playing ?? true);
        initialLoad.current = false;
        saveRoom();
      } catch (err) {
        if (isStale()) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[mmdVr] load failed", err);
        const previous = useMmdVrStore.getState().assetLoad;
        useMmdVrStore.getState().setAssetLoad({ ...previous, running: false, failures: [
          ...previous.failures, { id: "stage", fileName: previous.fileName, phase: previous.phase ?? "model", message: msg },
        ] });
        setStatusLine(`${labelsRef.current.failed}: ${msg}`);
        // Partially loaded models still need an evaluation pass.
        lastEvaluatedTimeRef.current = -Infinity;
        syncModelList();
        syncMaterialModels();
        syncObjects();
      }
    })());

    return () => {
      cancelled = true;
    };
  }, [runtime, assetRetryEpoch, setDuration, setMaterialModels, setModels, setObjects, setPlaying, setStatusLine]);

  const executing = useRef<number | null>(null);
  useEffect(() => {
    if (!command || physicsBusy || assetLoading || executing.current === command.token || isRoomStale()) return;
    if (initialLoad.current || useMmdVrStore.getState().physicsBusy || useMmdVrStore.getState().assetLoad.running) return;
    const stale = () => isRoomStale() || useBackpack.getState().command?.token !== command.token;
    const priorId = useBackpack.getState().live[command.id]?.runtimeId;
    executing.current = command.token;
    void (async () => {
      try {
        if (command.type === "place" && !canPlaceInScenery(scenery, command.x, command.z)) throw new Error(
          useLanguageStore.getState().language === "zh" ? "请指向可摆放的地面。" : "Choose an open spot on the ground.");
        // Includes recent material edits / scrubs. Closing during this command uses the last healthy room.
        saveRoom();
        const warning = await actors.execute(command, stale);
        if (stale()) return;
        if (command.type === "place" && priorId && !actors.objects.has(priorId) && physicsEnabled) runtime.resetPhysics(timeRef.current, priorId);
        staticSettleElapsed.current = 0;
        lastEvaluatedTimeRef.current = -Infinity;
        timeRef.current = restoreStageTime(timeRef.current, runtime.duration);
        syncModelList(); syncMaterialModels(); syncObjects();
        if (command.type === "motion" && runtime.duration > 0) { timeRef.current = 0; pendingSeekSeed.current = true; setPlaying(true); }
        setMmdVrClockTime(timeRef.current, true);
        if (!runtime.duration) setPlaying(false);
        updateProgress(useMmdVrStore.getState().assetLoad);
        saveRoom();
        useBackpack.getState().finishCommand(command);
        if (warning) useBackpack.setState({ error: warning });
      } catch (error) {
        if (!stale()) useBackpack.getState().finishCommand(command, error instanceof Error ? error.message : String(error));
      }
    })();
  }, [actors, command, physicsBusy, assetLoading]);

  useFrame((_, delta) => {
    applyLighting();

    const store = useMmdVrStore.getState();
    let physicsReseedNeeded = false;
    const removals = store.physicsBusy ? [] : store.takeModelRemovals();
    if (removals.length) {
      for (const id of removals) {
        actors.putAway(id);
      }
      syncModelList();
      syncMaterialModels();
      syncObjects();
      updateProgress(useMmdVrStore.getState().assetLoad);
    }
    const toggles = store.physicsBusy ? [] : store.takeVisibilityToggles();
    if (toggles.length) {
      for (const id of toggles) {
        const objectEntry = actors.objects.get(id);
        if (objectEntry) {
          objectEntry.group.visible = !objectEntry.group.visible;
          continue;
        }
        const entry = runtime.listModels().find((m) => m.id === id);
        if (entry) runtime.setModelVisible(id, !entry.visible);
      }
      syncModelList();
      syncObjects();
    }

    const place = store.physicsBusy ? null : store.takeGroundPlace();
    if (place && canPlaceInScenery(scenery, place.x, place.z)) {
      const objectEntry = actors.objects.get(place.id);
      if (objectEntry) {
        objectEntry.group.position.set(place.x, 0, place.z);
      } else if (runtime.listModels().some(m => m.id === place.id)) {
        runtime.setModelTransform(place.id, { positionX: place.x, positionY: 0, positionZ: place.z });
        physicsReseedNeeded = true;
      }
      actors.publishLive();
    }

    const transformRequests = store.physicsBusy ? [] : store.takeModelTransformRequests();
    if (transformRequests.length) {
      const models = runtime.listModels();
      for (const request of transformRequests) {
        const objectEntry = actors.objects.get(request.id);
        if (objectEntry) {
          if (request.reset) {
            objectEntry.group.position.set(...objectEntry.defaultPosition);
            objectEntry.group.scale.setScalar(1);
            objectEntry.group.rotation.y = 0;
          }
          if (request.scale != null) objectEntry.group.scale.setScalar(request.scale);
          if (request.rotationY != null) setObjectHeadingDegrees(objectEntry.group, request.rotationY);
          continue;
        }
        if (request.reset) {
          const index = models.findIndex((model) => model.id === request.id);
          const positionX = index >= 0 ? (index - (models.length - 1) / 2) * 1.1 : 0;
          runtime.setModelTransform(request.id, {
            positionX,
            positionY: 0,
            positionZ: 0,
            rotationX: 0,
            rotationY: 0,
            rotationZ: 0,
            scale: 1,
            ...(request.scale == null ? {} : { scale: request.scale }),
            ...(request.rotationY == null ? {} : { rotationY: request.rotationY }),
          });
          physicsReseedNeeded ||= transformRequiresPhysicsReseed(request);
          continue;
        }
        runtime.setModelTransform(request.id, {
          ...(request.scale == null ? {} : { scale: request.scale }),
          ...(request.rotationY == null ? {} : { rotationY: request.rotationY }),
        });
        physicsReseedNeeded ||= transformRequiresPhysicsReseed(request);
      }
      syncModelList();
      syncObjects();
    }
    const physicsResetRequested = store.physicsResetEpoch !== lastPhysicsResetEpochRef.current;
    if (physicsResetRequested) {
      lastPhysicsResetEpochRef.current = store.physicsResetEpoch;
    }
    if ((physicsReseedNeeded || physicsResetRequested) && store.physicsEnabled && !store.physicsBusy) {
      runtime.resetPhysics(timeRef.current);
      staticSettleElapsed.current = 0;
    }

    const rt = runtimeRef.current;
    if (!rt) return;
    const duration = rt.duration;
    const simulationDelta = clampMmdVrSimulationDelta(delta);
    const advancedMotion = playingRef.current && duration > 0 && !pendingSeekSeed.current;
    if (advancedMotion) {
      timeRef.current += simulationDelta;
      if (timeRef.current >= duration) {
        if (loopRef.current) {
          timeRef.current = 0;
          pendingSeekSeed.current = true;
        } else {
          timeRef.current = duration;
          playingRef.current = false;
          if (!stopPlayingQueuedRef.current) {
            stopPlayingQueuedRef.current = true;
            queueMicrotask(() => {
              stopPlayingQueuedRef.current = false;
              useMmdVrStore.getState().setPlaying(false);
            });
          }
        }
      }
    }
    const physicsOn = store.physicsEnabled && !store.physicsBusy;
    let physicsDelta = advancedMotion || store.physicsControllerCollisions ? simulationDelta : 0;
    if (physicsOn && duration <= 0) {
      if (!store.physicsControllerCollisions) physicsDelta = Math.min(simulationDelta, 5 - staticSettleElapsed.current);
      staticSettleElapsed.current = Math.min(5, staticSettleElapsed.current + physicsDelta);
    } else if (!store.physicsEnabled || duration > 0) staticSettleElapsed.current = 0;
    setMmdVrClockTime(timeRef.current);

    const perspective = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    if (perspective.isPerspectiveCamera && Math.abs(perspective.aspect - aspect) > 1e-5) {
      perspective.aspect = aspect;
      perspective.updateProjectionMatrix();
    }
    const evaluationTime = duration > 0 ? timeRef.current : 0;
    // Paused + no physics: bone/IK/morph evaluation would recompute identical
    // results, so skip it and keep rendering the frozen pose. Physics must
    // keep stepping when enabled so controller collisions stay alive, and a
    // seek while paused must still re-evaluate the target frame once.
    const timeChanged = Math.abs(evaluationTime - lastEvaluatedTimeRef.current) > 1e-5;
    if (playingRef.current || physicsOn || timeChanged || pendingSeekSeed.current) {
      const start = performance.now();
      rt.update(evaluationTime, physicsOn, perspective, aspect, false, physicsDelta, pendingSeekSeed.current);
      pendingSeekSeed.current = false;
      runtimeTiming.record(performance.now() - start);
      lastEvaluatedTimeRef.current = evaluationTime;
    }
    hapticContactPollRef.current += delta;
    if (hapticContactPollRef.current >= MMD_VR_HAPTIC_POLL_INTERVAL) {
      hapticContactPollRef.current %= MMD_VR_HAPTIC_POLL_INTERVAL;
      if (store.physicsEnabled
        && !store.physicsBusy
        && store.physicsControllerCollisions
        && store.prefs.physicsHapticLevel !== "off") {
        setMmdVrHapticContacts(
          rt.getControllerContactCount(0) > 0,
          rt.getControllerContactCount(1) > 0,
        );
      } else {
        clearMmdVrHapticContacts();
      }
    }
    physicsContactPollRef.current += delta;
    if (physicsContactPollRef.current >= 0.1) {
      physicsContactPollRef.current = 0;
      if (!store.physicsDebugEnabled) return;
      const contactCount = store.physicsEnabled && !store.physicsBusy ? rt.getControllerContactCount() : 0;
      if (contactCount !== store.physicsContactCount) store.setPhysicsContactCount(contactCount);
      if (store.physicsDebugEnabled) {
        const controllerCounts: [number, number] = store.physicsEnabled && !store.physicsBusy
          ? [rt.getControllerContactCount(0), rt.getControllerContactCount(1)]
          : [0, 0];
        if (controllerCounts[0] !== store.physicsControllerContactCounts[0]
          || controllerCounts[1] !== store.physicsControllerContactCounts[1]) {
          store.setPhysicsControllerContactCounts(controllerCounts);
        }
      }
      if (!store.physicsDebugEnabled) return;
      const dynamicBodyCount = store.physicsEnabled && !store.physicsBusy ? rt.getDynamicRigidBodyCount() : 0;
      if (dynamicBodyCount !== store.physicsDynamicBodyCount) store.setPhysicsDynamicBodyCount(dynamicBodyCount);
      const rigidBodyCount = store.physicsEnabled && !store.physicsBusy ? rt.getRigidBodyCount() : 0;
      const stepCount = store.physicsEnabled && !store.physicsBusy ? rt.getPhysicsStepCount() : 0;
      if (rigidBodyCount !== store.physicsRigidBodyCount || stepCount !== store.physicsStepCount) {
        store.setPhysicsRuntimeStats(rigidBodyCount, stepCount);
      }
    }
  });

  return (
    <>
      <color attach="background" args={[accent.stageBg]} />
      {mmdPrefs.stageFogEnabled ? (
        <fog attach="fog" args={[lightCfg.fogColor, Math.min(10, viewDistance * 0.45), viewDistance]} />
      ) : null}
      {mmdPrefs.stageSkyEnabled && daySet ? <DaySky sun={lightCfg.sunPos} warm={lightPreset === "warm"} /> : mmdPrefs.stageSkyEnabled ? (
        <StageSky zenith={lightCfg.skyZenith} horizon={lightCfg.skyHorizon} bottom={lightCfg.fogColor} />
      ) : null}
      <ambientLight color={lightCfg.ambientColor} intensity={lightCfg.ambient} />
      <directionalLight
        ref={sunRef}
        position={lightCfg.sunPos}
        color={lightCfg.sunColor}
        intensity={lightCfg.sun}
        castShadow={profile.shadows}
        shadow-mapSize-width={profile.shadows ? profile.shadowMapSize : 256}
        shadow-mapSize-height={profile.shadows ? profile.shadowMapSize : 256}
        shadow-camera-near={0.5}
        shadow-camera-far={shadowFar}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
      />
      <hemisphereLight args={[lightCfg.hemiSky, lightCfg.hemiGround, lightCfg.hemi]} />
      {mmdPrefs.stageRimLightEnabled ? (
        <pointLight
          color={lightCfg.rimColor}
          intensity={rimIntensity}
          distance={8}
          decay={2}
          position={lightCfg.rimPosition}
        />
      ) : null}
      <StageFloor
        segments={profile.floorSegments}
        shadows={profile.shadows}
        placeMode={placeMode}
        floorColor={lightCfg.floorColor}
        deck={scenery !== "floor"}
      />
      {scenery === "liveHouse" && <LiveHouse concert={lightPreset === "contrast"} />}
      {daySet && <DaylightSet id={daySet} shadows={profile.shadows} />}
      {mmdPrefs.stageLightPoolEnabled ? (
        <StageLightPool color={lightCfg.poolColor} opacity={Math.min(0.14, rimIntensity * 0.08)} />
      ) : null}
      {showSceneryGrid(scenery, profile.showGrid, mmdPrefs.gridPref === "on", placeMode) ? (
        <gridHelper
          args={[12, 12, accent.gridMajor, accent.gridMinor]}
          position={[0, 0.01, 0]}
        />
      ) : null}
    </>
  );
}
