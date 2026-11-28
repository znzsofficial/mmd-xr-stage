import { useFrame, useThree } from "@react-three/fiber";
import { runtimeTiming } from "../diagnostics/runtimeTiming";
import {elapsed,type PhysicsSwitchWork} from '../diagnostics/physicsSwitchWork';
import { useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import {
  isMmdRuntimeRebuildError,
  type MmdRuntimeHandle,
} from "../mmdRuntime/mmdRuntime";
import { useLanguageStore } from "../../languageStore";
import type { MmdVrAssetSlot } from "../backpack/sessionAssets";
import { invalidateBackpackCommands, saveBackpackLayout, useBackpack } from "../backpack/store";
import {
  clampMmdVrSimulationDelta,
  resetMmdVrClock,
  setMmdVrClockDuration,
  setMmdVrClockTime,
} from "./mmdVrClock";
import { getMmdVrRenderProfile } from "../settings/mmdVrQuality";
import { minSceneViewDistance } from '../settings/mmdVrAdjustments';
import { useMmdVrStore, type MmdVrMaterialState } from "../mmdVrStore";
import { objectHeadingDegrees } from "./objectHeading";
import { roomSets } from '../scenery/roomSets';
import { StageEnvironment } from './StageEnvironment';
import { resolveStageLighting } from './lighting';
import {getVelvetLight,resolveVelvetLight,subscribeVelvetLight} from '../scenery/velvet/velvetLight';
import {xrRoomRestoreTiming} from '../diagnostics/roomRestoreTiming';
import type {RoomMotionCache} from '../mmdRuntime/roomMotionCache';
import {scheduleBulletModuleWarm} from '../mmdRuntime/bulletModule';
import type {RoomAlphaTiles} from '../mmdRuntime/roomAlphaTiles';
import { createRoomRuntime, type RoomActorBackend } from './createRoomRuntime';
import { createPlacementWork } from '../diagnostics/placementWork';
import type { SceneryId } from "../scenery/catalog";
import { resolvePlacementHeight, visiblePick } from "../scenery/placementAreas";
import { mountStockingRoom } from '../wardrobe/stockingSurface';
import { ControllerContactHaptics } from '../xr/contact/controllerContactHaptics';
import { FloorInputContext } from '../xr/floorInput';
import { consumeRoomModelCommands } from "./roomModelCommands";
import { createAssetLoadQueue, emptyAssetLoadProgress, type AssetLoadProgress } from "./loading/mmdAssetLoadQueue";
import { restoreStageTime, type StageSnapshot } from "./stageSnapshot";
import { createStageActors } from "./stageActors";
import { poseWristToy } from '../play/wristSocket';
import { createPropColliderFeed, isContactTool } from '../play/propColliders';
import {createRoomPropDisplay} from './roomPropDisplay';
import { useStagePlay } from '../play/stagePlay';
import { PlayPiece } from '../play/HeldPlay';
import { useScreenWristCue } from '../play/screenWristCue';
import {useHudWorldInput} from '../hud/hudWorldInput';
import { RemoteWearable } from '../play/remote/RemoteWearable';
import {presentRemoteWearable,wearableIn} from '../play/remote/wearableCollider';
import {mountPoseRoom} from '../pose/poseSession';
import {poseBlocksPelvicRig} from '../pelvic/store';
import {PoseHandles} from '../pose/PoseHandles';
import {PelvicRig,type PelvicRigHandle} from '../pelvic/PelvicRig';
import {PelvicObserver} from '../pelvic/PelvicObserver';
import {createBodyRoom} from '../bodyState/room';
import {mountRoomMilk} from '../bodyState/lactation/roomMilk';

const noRoomLightEvents=()=>()=>{};

/** A single room owns a runtime: late restores and physics rebuilds can never target a new room's actors. */
export function MmdVrStageRoom({ scenery, saved, slots, motionCache, alphaTiles,backend }: { scenery: SceneryId; saved: StageSnapshot | null; slots: readonly MmdVrAssetSlot[]; motionCache?:RoomMotionCache; alphaTiles?:RoomAlphaTiles;backend?:RoomActorBackend }) {
  const { scene, camera, size, gl } = useThree();
  const mmdPrefs = useMmdVrStore((s) => s.prefs);
  const profile = getMmdVrRenderProfile(mmdPrefs);
  const lightPreset = mmdPrefs.lightPreset;
  const room=roomSets[scenery];
  const studio=scenery==='velvetStudio';
  const strip=useSyncExternalStore(studio?subscribeVelvetLight:noRoomLightEvents,getVelvetLight);
  const lightCfg=useMemo(()=>{
    const base=resolveStageLighting(lightPreset,room);
    return studio?resolveVelvetLight(base,strip):base;
  },[lightPreset,room,studio,strip]);
  const viewDistance = mmdPrefs.viewDistance;
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
  const warmAfterPlacement = useRef(false);
  const cancelWarm = useRef<(() => void) | undefined>(undefined);
  const lastEvaluatedTimeRef = useRef(-Infinity);
  useLayoutEffect(()=>{lastEvaluatedTimeRef.current=-Infinity;},[mmdPrefs.chestCompression]);
  const timeRef = useRef(0);
  const staticSettleElapsed = useRef(0);
  const pendingSeekSeed = useRef(false);
  const physicsContactPollRef = useRef(0);
  const contactHaptics = useContext(ControllerContactHaptics);
  const floorInput = useContext(FloorInputContext);
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
  const appliedSun = useRef<THREE.DirectionalLight | null>(null);
  const lifecycleGenerationRef = useRef(0);
  const appliedPhysicsEnabledRef = useRef(saved?.physicsEnabled ?? useMmdVrStore.getState().physicsEnabled);
  const labelsRef = useRef({
    loading: "Loading…",
    failed: "Load failed",
    empty: "No model",
    physicsRestored: "Physics failed; previous state restored",
    physicsFatal: "Physics recovery failed; exit and enter again",
  });
  const physicsEnabled = useMmdVrStore((s) => s.physicsEnabled);
  const physicsBusy = useMmdVrStore(s => s.physicsBusy);
  const assetLoading = useMmdVrStore(s => s.assetLoad.running);
  const command = useBackpack(s => s.command);
  const waitForPhysicsSwitch = physicsBusy || assetLoading || !!command;
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

  useLayoutEffect(() => {
    if (!contactHaptics) return;
    const unsubscribe = floorInput?.subscribe(contactHaptics.reset);
    return () => { unsubscribe?.(); contactHaptics.reset(); };
  }, [contactHaptics, floorInput]);

  function saveRoom(): StageSnapshot | null {
    const s = useMmdVrStore.getState();
    if (retired.current || !readyToSaveRef.current || s.physicsBusy || s.physicsFatal || s.assetLoad.running || s.assetLoad.failures.length) return null;
    const snapshot = { ...actors.capture(), scenery, time: timeRef.current, playing: s.playing, loop: s.loop,
      physicsEnabled: appliedPhysicsEnabledRef.current };
    saveBackpackLayout(snapshot);
    return snapshot;
  }
  function captureStage() {
    return retired.current ? useBackpack.getState().layouts[useMmdVrStore.getState().prefs.scenery] ?? null : saveRoom();
  }

  // Lifetime is tied to the room and renderer, not view/camera changes in XR.
  const propFeed=useMemo(createPropColliderFeed,[scene,scenery]);
  const screenPropSettle=useRef(0);
  const poseSettle=useRef(0);
  const bodyRoom=useRef<ReturnType<typeof createBodyRoom>|null>(null);
  const milkRoom=useRef<ReturnType<typeof mountRoomMilk>|null>(null);
  const stockingRoom=useRef<ReturnType<typeof mountStockingRoom>|null>(null);
  const poseRoom=useRef<ReturnType<typeof mountPoseRoom>|null>(null);
  const runtime = useMemo(() => createRoomRuntime(scene, gl, camera, motionCache, alphaTiles,propFeed,backend),
    [scene, gl, motionCache, alphaTiles,propFeed,backend]);
  const actors = useMemo(() => createStageActors(scene, runtime, () => appliedPhysicsEnabledRef.current, () => timeRef.current), [scene, runtime]);
  const wristGroup = useRef<THREE.Group>(null);
  const pelvic=useRef<PelvicRigHandle>(null);
  const standSample=useMemo(()=>({pieceWorld:new THREE.Matrix4(),binding:{} as object}),[]);
  function poseCharacterProp(rt:MmdRuntimeHandle){
    const group=wristGroup.current;if(!group)return null;
    const prop=useStagePlay.getState().character, live=prop&&useBackpack.getState().live[prop.assetId];
    if(live?.visible&&prop&&prop.toy===characterToy&&!useMmdVrStore.getState().physicsBusy){
      const root=rt.getModelRoot(live.runtimeId);poseWristToy(group,root,prop);return group.visible?root:null;
    }
    group.visible=false;return null;
  }
  useLayoutEffect(()=>{
    const stop=useStagePlay.subscribe((s,p)=>{if(s.held!==p.held||s.character!==p.character||s.stand!==p.stand)propFeed.clear();});
    const stopRoom=useMmdVrStore.subscribe(s=>{if(!s.overlayOpen||s.prefs.scenery!==scenery||s.physicsBusy||!s.physicsEnabled||s.physicsFatal||s.assetLoad.running)propFeed.clear();});
    return ()=>{stop();stopRoom();propFeed.clear();};
  },[propFeed,scenery]);
  const propDisplay=useMemo(createRoomPropDisplay,[runtime]);
  useLayoutEffect(()=>propDisplay.subscribe(scenery),[propDisplay,scenery]);
  const characterToy = useStagePlay(s => s.character?.toy);
  const isRoomStale = useCallback(() => retired.current || !useMmdVrStore.getState().overlayOpen || useMmdVrStore.getState().prefs.scenery !== scenery || runtimeRef.current !== runtime,[scenery,runtime]);
  const wristCue=useScreenWristCue(characterToy,{wrist:wristGroup,scene,canvas:gl.domElement,getRoot:runtime.getModelRoot,isRoomStale});

  useLayoutEffect(()=>{
    const milk=mountRoomMilk(scene,gl,runtime,isRoomStale);milkRoom.current=milk;
    return ()=>{milkRoom.current=null;milk.dispose();};
  },[scene,gl,runtime,scenery]);

  useLayoutEffect(()=>{
    const room=mountStockingRoom(scene,runtime,isRoomStale,(ray,p)=>visiblePick(scenery,ray.origin,p.x,p.y,p.z));
    stockingRoom.current=room;
    return ()=>{stockingRoom.current=null;room.dispose();};
  },[scene,runtime,scenery,isRoomStale]);

  useLayoutEffect(()=>{
    const body=createBodyRoom(runtime,()=>{lastEvaluatedTimeRef.current=-Infinity;});bodyRoom.current=body;
    poseRoom.current=mountPoseRoom({
      open(id){if(isRoomStale())return null;propDisplay.restore();pelvic.current?.interrupt();return runtime.beginPose(id,timeRef.current);},
      close(id){propDisplay.restore();runtime.endPose(id);},
      refitSkirt(id){if(!isRoomStale())runtime.requestSkirtRefit(id);},
      dirty(reseed,runtimeId){lastEvaluatedTimeRef.current=-Infinity;poseSettle.current=.8;
        if(reseed&&runtimeId&&appliedPhysicsEnabledRef.current){propDisplay.restore();runtime.resetPhysics(timeRef.current,runtimeId);}}
    });
    return ()=>{poseRoom.current?.dispose();poseRoom.current=null;bodyRoom.current=null;body.dispose();};
  },[runtime,propDisplay]);

  useLayoutEffect(() => {
    runtimeRef.current = runtime;
    const { saved } = initialAssets.current;
    useMmdVrStore.setState({
      physicsEnabled: appliedPhysicsEnabledRef.current,
      ...(saved ? { loop: saved.loop } : {}),
      physicsBusy: false, physicsError: null, physicsFatal: false, playing: false,
      models: [], modelCount: 0, objects: [], materialModels: {}, materialPanelModelId: null,
      pendingModelTransforms: [],
      pendingVisibilityToggles: [], pendingModelRemovals: [], duration: 0, assetLoad: emptyAssetLoadProgress(),
    });
    resetMmdVrClock();
    return () => { runtimeRef.current = null; warmAfterPlacement.current = false; cancelWarm.current?.(); };
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
      getWardrobe: (id,file) => isRoomStale()?null:handle.getWardrobe?.(id,file)??null,
      invalidateWardrobe: () => { lastEvaluatedTimeRef.current=-Infinity; },
      setMaterialVisible: (modelId, materialName, visible) => handle.setMaterialVisible(modelId, materialName, visible),
      setMaterialOverride: (modelId, materialName, patch) => handle.setMaterialOverride(modelId, materialName, patch),
    });
    return () => setRuntimeRef(null);
  }, [runtime, setRuntimeRef]);

  useEffect(() => {
    const state = useMmdVrStore.getState();
    if (waitForPhysicsSwitch || isRoomStale() || state.physicsBusy || state.physicsFatal || physicsEnabled !== state.physicsEnabled || physicsEnabled === appliedPhysicsEnabledRef.current) return;
    captureStage(); // Last complete copy while a rebuild temporarily owns the models.
    const work:PhysicsSwitchWork|undefined=useMmdVrStore.getState().presentation==='xr'?{}:undefined;
    setPhysicsBusy(true,work);
    useMmdVrStore.getState().setPhysicsError(null);
    // A newer request waits for this result. Even an immediately reversed switch
    // becomes the room's applied value if the runtime successfully completes it.
    void runtime.setPhysicsEnabled(physicsEnabled,work).then(() => {
      if (!isRoomStale()) {
        const at=work?performance.now():0;
        appliedPhysicsEnabledRef.current = physicsEnabled;
        syncModelList();
        syncMaterialModels();
        lastEvaluatedTimeRef.current = -Infinity;
        elapsed(work,'publishUiMs',at);
      }
    }).catch((error) => {
      if (!isRoomStale()) {
        console.error("[mmdVr] physics toggle failed", error);
        const fatal = isMmdRuntimeRebuildError(error);
        if (fatal) readyToSaveRef.current = false;
        syncModelList();
        syncMaterialModels();
        lastEvaluatedTimeRef.current = -Infinity;
        const store = useMmdVrStore.getState();
        store.setPhysicsEnabled(fatal ? false : appliedPhysicsEnabledRef.current);
        store.setPhysicsError(fatal ? labelsRef.current.physicsFatal : labelsRef.current.physicsRestored, fatal);
        if (fatal) store.setPlaying(false);
      }
    }).finally(() => {
      if (!isRoomStale()) setPhysicsBusy(false);
    });
  }, [physicsEnabled, runtime, setPhysicsBusy, waitForPhysicsSwitch]);


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
    if (!sun || appliedSun.current===sun) return;
    appliedSun.current=sun;
    const cfg = lightCfg;
    sun.position.set(...cfg.sunPos);
    sun.intensity = cfg.sun;
    sun.color.set(cfg.sunColor);
    sun.castShadow = getMmdVrRenderProfile(useMmdVrStore.getState().prefs).shadows;
    runtime.setLighting({
      balancedModelColor: mmdPrefs.balancedModelColor,
      envIntensity: 0,
      ambientIntensity: cfg.ambient,
      directionalLight: sun,
      envMap: null,
    });
  }

  useLayoutEffect(() => {
    appliedSun.current=null;
    applyLighting();
  }, [runtime, lightCfg, profile.shadows, mmdPrefs.balancedModelColor]);

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    camera.far = Math.max(minSceneViewDistance(scenery),viewDistance);
    camera.updateProjectionMatrix();
  }, [camera, scenery, viewDistance]);

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

  function commitActorLayout(startMotion = false) {
    const duration = runtime.duration;
    timeRef.current = restoreStageTime(timeRef.current, duration);
    syncModelList();
    syncMaterialModels();
    syncObjects();
    if (startMotion && duration > 0) { timeRef.current = 0; pendingSeekSeed.current = true; setPlaying(true); }
    setMmdVrClockTime(timeRef.current, true);
    if (!duration) setPlaying(false);
    // A removed actor may have owned a repair ticket. Refresh the outstanding
    // failures before deciding whether this layout may replace the last good one.
    updateProgress(useMmdVrStore.getState().assetLoad);
    saveRoom();
  }

  function publishEdits(modelShown: boolean) {
    if (modelShown) lastEvaluatedTimeRef.current = -Infinity;
    syncModelList();
    syncObjects();
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
    const trace=initialLoad.current&&saved&&useMmdVrStore.getState().presentation==='xr'?xrRoomRestoreTiming.bind(scenery):undefined;
    if (!loadQueueRef.current) {
      const tasks=actors.restoreTasks(slots,saved,isRoomStale,trace);
      loadQueueRef.current = createAssetLoadQueue(trace?.wrap(tasks)??tasks);
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
        trace?.ready(!useMmdVrStore.getState().assetLoad.failures.length);
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
        trace?.ready(false);
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
    executing.current = command.token;
    void (async () => {
      try {
        const floorY = command.type === 'place' ? resolvePlacementHeight(scenery, command.x, command.z, command.supportY) : 0;
        if (floorY === null) throw new Error(
          useLanguageStore.getState().language === "zh" ? "请指向可摆放的地面。" : "Choose an open spot on the ground.");
        // Includes recent material edits / scrubs. Closing during this command uses the last healthy room.
        saveRoom();
        const freshModel = command.type === 'place' && !command.moveRuntimeId && useBackpack.getState().placement?.kind === 'model';
        const work = freshModel ? createPlacementWork() : undefined;
        if (command.type === 'motion' && !command.file) propDisplay.restore();
        const warning = await actors.execute(command, stale, work, floorY);
        if (stale()) return;
        staticSettleElapsed.current = 0;
        lastEvaluatedTimeRef.current = -Infinity;
        commitActorLayout(command.type === "motion" && !!command.file);
        useBackpack.getState().finishCommand(command, undefined, work);
        if (warning) useBackpack.setState({ error: warning });
        // Only a completed fresh manual model drop (not a move/restore/import).
        if (freshModel && !warning && !useMmdVrStore.getState().physicsEnabled) warmAfterPlacement.current = true;
      } catch (error) {
        if (!stale()) {
          if (command.type === 'motion') lastEvaluatedTimeRef.current = -Infinity;
          useBackpack.getState().finishCommand(command, error instanceof Error ? error.message : String(error));
        }
      }
    })();
  }, [actors, command, physicsBusy, assetLoading]);

  useFrame(({clock}, delta, frame) => {
    // A final callback can arrive between retirement and unsubscription. Do
    // not take page-wide commands, publish clocks, or sample the next room.
    if(isRoomStale())return;
    wearableIn(scene)?.restore();
    propDisplay.restore();
    applyLighting();

    // Let the placement-ready frame run first. An idle callback can outlive
    // a put-away, another command or an A→B→A room change: recheck live state.
    if (warmAfterPlacement.current) {
      warmAfterPlacement.current = false;
      cancelWarm.current?.();
      cancelWarm.current = scheduleBulletModuleWarm(() => {
        const s = useMmdVrStore.getState();
        if (isRoomStale() || !s.models.length || s.physicsEnabled || s.physicsFatal) return false;
        return s.physicsBusy || s.assetLoad.running || useBackpack.getState().busy ? 'busy' : true;
      });
    }

    const store = useMmdVrStore.getState();
    if(!store.physicsBusy&&store.physicsEnabled===appliedPhysicsEnabledRef.current)poseRoom.current?.afterPhysics();
    const physicsReseedNeeded = !store.physicsBusy &&
      consumeRoomModelCommands(store, actors, runtime, commitActorLayout, publishEdits);
    // A rebuild defers mounted edits, but still acknowledges an explicit reset this frame.
    const physicsResetRequested = store.physicsResetEpoch !== lastPhysicsResetEpochRef.current;
    if (physicsResetRequested) {
      lastPhysicsResetEpochRef.current = store.physicsResetEpoch;
    }
    if ((physicsReseedNeeded || physicsResetRequested) && store.physicsEnabled && !store.physicsBusy) {
      propFeed.clear();
      runtime.resetPhysics(timeRef.current);
      staticSettleElapsed.current = 0;
    }

    const rt = runtimeRef.current;
    if (!rt) return;
    const duration = rt.duration;
    const simulationDelta = clampMmdVrSimulationDelta(delta);
    const poseChanged=poseSettle.current>0;
    poseSettle.current=Math.max(0,poseSettle.current-simulationDelta);
    if(!isRoomStale()&&!store.physicsBusy&&!store.physicsFatal&&!store.assetLoad.running&&!useBackpack.getState().busy&&
      (store.presentation!=='xr'||frame?.session.visibilityState==='visible'))bodyRoom.current?.advance(simulationDelta);
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
              if(!isRoomStale()&&!playingRef.current)useMmdVrStore.getState().setPlaying(false);
            });
          }
        }
      }
    }
    const physicsOn = store.physicsEnabled && !store.physicsBusy;
    const owners=useStagePlay.getState(), inXR=store.presentation==='xr';
    const bag=useBackpack.getState();
    const pelvicBlocked=isRoomStale()||store.physicsBusy||store.physicsFatal||store.assetLoad.running||bag.busy||!!bag.draft||
      pendingSeekSeed.current||physicsResetRequested||physicsReseedNeeded||poseBlocksPelvicRig()||
      (inXR&&(frame?.session.visibilityState!=='visible'||useHudWorldInput.getState().blocked));
    let propActive=false;
    if(physicsOn&&!isRoomStale()&&!store.physicsFatal&&!store.assetLoad.running&&!useBackpack.getState().busy&&!pendingSeekSeed.current&&(!inXR||frame?.session.visibilityState==='visible')){
      // A character socket reads the last *displayed*, visually scaled wrist.
      // Never evaluate a second VMD pose to feed its own Bullet world. Refit
      // the drawn piece to the newly evaluated wrist below, after writeback.
      if(isContactTool(owners.character?.toy))poseCharacterProp(rt);
      // An attached stand, like a wrist, supplies its last displayed pose for
      // this step. Refresh visuals against the new evaluated owner below.
      const mount=owners.stand&&!pelvicBlocked?pelvic.current?.getStandRoot():null;
      const binding=mount&&pelvic.current?.getStandBinding(),piece=binding&&mount.getObjectByName('play:piece:dildo');
      if(piece){piece.updateWorldMatrix(true,false);standSample.pieceWorld.copy(piece.matrixWorld);standSample.binding=binding;}
      propActive=propFeed.sample(scene,wristGroup.current,owners.held,owners.character,frame,piece?standSample:null);
    }else propFeed.clear();
    // Screen has no free player hand. Keep the paused solver awake for a
    // mounted wrist prop and briefly after stowing so a lifted hem can fall.
    screenPropSettle.current=!physicsOn||inXR?0:propActive?1:Math.max(0,screenPropSettle.current-simulationDelta);
    const interactive = inXR||screenPropSettle.current>0||poseChanged;
    let physicsDelta = advancedMotion || interactive ? simulationDelta : 0;
    if (physicsOn && duration <= 0) {
      if (!interactive) physicsDelta = Math.min(simulationDelta, 5 - staticSettleElapsed.current);
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
    backend?.beginFrame(frame??null, gl.xr.getReferenceSpace(), pendingSeekSeed.current || physicsResetRequested || physicsReseedNeeded);
    const evaluate = playingRef.current || physicsOn || timeChanged || poseChanged || pendingSeekSeed.current;
    if (evaluate) {
      const start = performance.now();
      rt.update(evaluationTime, physicsOn, perspective, aspect, false, physicsDelta, pendingSeekSeed.current);
      pendingSeekSeed.current = false;
      if(store.presentation==='xr')runtimeTiming.record(performance.now() - start);
      lastEvaluatedTimeRef.current = evaluationTime;
    }
    // Both reads share the evaluated step. Prop feedback still writes after the ordinary grip pulse.
    if (inXR) contactHaptics?.advance(frame, delta, clock.elapsedTime * 1000,
      physicsOn ? store.prefs.physicsHapticLevel : 'off', rt.getControllerContactCount);
    const posedCarrier=poseCharacterProp(rt);
    wristCue.driver.current?.advance(delta,posedCarrier);
    presentRemoteWearable(scene);
    pelvic.current?.advance(delta,frame,pelvicBlocked);
    if(!isRoomStale()&&!store.physicsBusy&&!store.physicsFatal&&!store.assetLoad.running)
      propDisplay.present(rt,scene,wristGroup.current,pelvic.current,frame,clock);
    // Mail from an actor-style decode can arrive even while VMD and physics
    // are both paused. Commit on this tracked draw, after all displayed pose
    // layers, without re-evaluating VMD or dispatching idle GPU pose work.
    const propMorphChanged=propDisplay.consumeMorphChange();
    backend?.prepareRender(evaluate||propMorphChanged);
    stockingRoom.current?.advance(evaluate||propMorphChanged);
    milkRoom.current?.advance(delta,frame);
    if(store.presentation!=='xr')return;
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
      {characterToy && <group ref={wristGroup} name="play:character" pointerEvents="none" visible={false}><PlayPiece toy={characterToy}/></group>}
      {wristCue.art}
      <RemoteWearable getSurface={runtime.getModelSurface} getEggSurface={backend?.getEggSurface} isRoomStale={isRoomStale}/>
      <PelvicRig ref={pelvic} getRoot={runtime.getModelRoot} getSurface={runtime.getModelSurface} getGarmentPose={backend?.getGarmentPose}/>
      <PelvicObserver rig={pelvic}/>
      <PoseHandles/>
      <StageEnvironment scenery={scenery} prefs={mmdPrefs} profile={profile} lighting={lightCfg}
        sunRef={sunRef}/>
    </>
  );
}
