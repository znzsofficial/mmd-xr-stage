import { useFrame, useThree } from "@react-three/fiber";
import { runtimeTiming } from "../runtimeTiming";
import {elapsed,type PhysicsSwitchWork} from '../physicsSwitchWork';
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  isMmdRuntimeRebuildError,
  type MmdRuntimeHandle,
} from "../mmdRuntime/mmdRuntime";
import { useLanguageStore } from "../../languageStore";
import type { MmdVrAssetSlot } from "../mmdVrAssets";
import { invalidateBackpackCommands, saveBackpackLayout, useBackpack } from "../backpack";
import {
  clampMmdVrSimulationDelta,
  resetMmdVrClock,
  setMmdVrClockDuration,
  setMmdVrClockTime,
} from "../mmdVrClock";
import { getMmdVrRenderProfile } from "../mmdVrQuality";
import { useMmdVrStore, type MmdVrMaterialState } from "../mmdVrStore";
import { objectHeadingDegrees, setObjectHeadingDegrees } from "../objectHeading";
import { roomSets } from '../scenery/roomSets';
import { StageEnvironment } from './StageEnvironment';
import { resolveStageLighting } from './lighting';
import {xrRoomRestoreTiming} from '../roomRestoreTiming';
import type {RoomMotionCache} from '../mmdRuntime/roomMotionCache';
import {scheduleBulletModuleWarm} from '../mmdRuntime/bulletModule';
import type {RoomAlphaTiles} from '../mmdRuntime/roomAlphaTiles';
import { createRoomRuntime } from './createRoomRuntime';
import { createPlacementWork } from '../placementWork';
import type { SceneryId } from "../scenery/catalog";
import { canPlaceInScenery,placementHeight } from "../scenery/placementAreas";
import {
  clearMmdVrHapticContacts,
  MMD_VR_HAPTIC_POLL_INTERVAL,
  setMmdVrHapticContacts,
} from "../mmdVrHaptics";
import { transformRequiresPhysicsReseed } from "../mmdVrPhysicsReseed";
import { createAssetLoadQueue, emptyAssetLoadProgress, type AssetLoadProgress } from "../mmdAssetLoadQueue";
import { restoreStageTime, type StageSnapshot } from "../stageSnapshot";
import { createStageActors } from "../stageActors";
import { poseWristToy } from '../play/wristSocket';
import { useStagePlay } from '../play/stagePlay';
import { PlayPiece } from '../play/HeldPlay';

/** A single room owns a runtime: late restores and physics rebuilds can never target a new room's actors. */
export function MmdVrStageRoom({ scenery, saved, slots, motionCache, alphaTiles }: { scenery: SceneryId; saved: StageSnapshot | null; slots: readonly MmdVrAssetSlot[]; motionCache?:RoomMotionCache; alphaTiles?:RoomAlphaTiles }) {
  const { scene, camera, size, gl } = useThree();
  const mmdPrefs = useMmdVrStore((s) => s.prefs);
  const profile = getMmdVrRenderProfile(mmdPrefs);
  const lightPreset = mmdPrefs.lightPreset;
  const room=roomSets[scenery];
  const lightCfg = useMemo(() => resolveStageLighting(lightPreset, room), [room, lightPreset]);
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

  useEffect(() => clearMmdVrHapticContacts, []);

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
  const runtime = useMemo(() => createRoomRuntime(scene, gl, camera, motionCache, alphaTiles),
    [scene, gl, motionCache, alphaTiles]);
  const actors = useMemo(() => createStageActors(scene, runtime, () => appliedPhysicsEnabledRef.current, () => timeRef.current), [scene, runtime]);
  const wristGroup = useRef<THREE.Group>(null);
  const characterToy = useStagePlay(s => s.character?.toy);
  const isRoomStale = () => retired.current || !useMmdVrStore.getState().overlayOpen || useMmdVrStore.getState().prefs.scenery !== scenery || runtimeRef.current !== runtime;

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
    if (!sun) return;
    const key = `${scenery}|${lightPreset}|${profile.shadows}|${mmdPrefs.balancedModelColor}|${sun.uuid}`;
    if (lightingKeyRef.current === key) return;
    lightingKeyRef.current = key;
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
    lightingKeyRef.current = "";
    applyLighting();
  }, [runtime, lightCfg, profile.shadows, mmdPrefs.balancedModelColor]);

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
        if (command.type === "place" && !canPlaceInScenery(scenery, command.x, command.z)) throw new Error(
          useLanguageStore.getState().language === "zh" ? "请指向可摆放的地面。" : "Choose an open spot on the ground.");
        // Includes recent material edits / scrubs. Closing during this command uses the last healthy room.
        saveRoom();
        const freshModel = command.type === 'place' && !command.moveRuntimeId && useBackpack.getState().placement?.kind === 'model';
        const work = freshModel ? createPlacementWork() : undefined;
        const warning = await actors.execute(command, stale, work,command.type==='place'?placementHeight(scenery,command.x,command.z):0);
        if (stale()) return;
        staticSettleElapsed.current = 0;
        lastEvaluatedTimeRef.current = -Infinity;
        timeRef.current = restoreStageTime(timeRef.current, runtime.duration);
        syncModelList(); syncMaterialModels(); syncObjects();
        if (command.type === "motion" && runtime.duration > 0) { timeRef.current = 0; pendingSeekSeed.current = true; setPlaying(true); }
        setMmdVrClockTime(timeRef.current, true);
        if (!runtime.duration) setPlaying(false);
        updateProgress(useMmdVrStore.getState().assetLoad);
        saveRoom();
        useBackpack.getState().finishCommand(command, undefined, work);
        if (warning) useBackpack.setState({ error: warning });
        // Only a completed fresh manual model drop (not a move/restore/import).
        if (freshModel && !warning && !useMmdVrStore.getState().physicsEnabled) warmAfterPlacement.current = true;
      } catch (error) {
        if (!stale()) useBackpack.getState().finishCommand(command, error instanceof Error ? error.message : String(error));
      }
    })();
  }, [actors, command, physicsBusy, assetLoading]);

  useFrame((_, delta) => {
    applyLighting();

    // Let the placement-ready frame run first. An idle callback can outlive
    // a put-away, another command or an A→B→A room change: recheck live state.
    if (warmAfterPlacement.current) {
      warmAfterPlacement.current = false;
      cancelWarm.current?.();
      cancelWarm.current = scheduleBulletModuleWarm(() => {
        const s = useMmdVrStore.getState();
        return !isRoomStale() && s.models.length > 0 && !s.physicsEnabled && !s.physicsBusy && !s.assetLoad.running && !useBackpack.getState().busy;
      });
    }

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
    const interactive = store.presentation==='xr';
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
    if (playingRef.current || physicsOn || timeChanged || pendingSeekSeed.current) {
      const start = performance.now();
      rt.update(evaluationTime, physicsOn, perspective, aspect, false, physicsDelta, pendingSeekSeed.current);
      pendingSeekSeed.current = false;
      if(store.presentation==='xr')runtimeTiming.record(performance.now() - start);
      lastEvaluatedTimeRef.current = evaluationTime;
    }
    if (wristGroup.current) {
      const prop = useStagePlay.getState().character;
      const live = prop && useBackpack.getState().live[prop.assetId];
      if (live && prop && !store.physicsBusy) poseWristToy(wristGroup.current, rt.getModelRoot(live.runtimeId), prop);
      else wristGroup.current.visible = false;
    }
    if(store.presentation!=='xr')return;
    hapticContactPollRef.current += delta;
    if (hapticContactPollRef.current >= MMD_VR_HAPTIC_POLL_INTERVAL) {
      hapticContactPollRef.current %= MMD_VR_HAPTIC_POLL_INTERVAL;
      if (store.physicsEnabled
        && !store.physicsBusy
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
      {characterToy && <group ref={wristGroup} name="play:character" pointerEvents="none" visible={false}><PlayPiece toy={characterToy}/></group>}
      <StageEnvironment scenery={scenery} prefs={mmdPrefs} profile={profile} lighting={lightCfg}
        sunRef={sunRef}/>
    </>
  );
}
