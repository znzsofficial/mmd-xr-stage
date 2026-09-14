import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  createMmdRuntimeHandle,
  isMmdRuntimeRebuildError,
  type MmdRuntimeHandle,
} from "../mmdRuntime/mmdRuntime";
import { useLanguageStore } from "../../languageStore";
import { getMmdVrSessionAssets, type MmdVrModelSlot, type MmdVrObjectSlot } from "../mmdVrAssets";
import { createMmdVrGltfLoader } from "../mmdVrGltf";
import { relativePath } from "../../mmdImport/folderFiles";
import {
  clampMmdVrSimulationDelta,
  resetMmdVrClock,
  setMmdVrClockDuration,
  setMmdVrClockTime,
} from "../mmdVrClock";
import { getMmdVrRenderProfile } from "../mmdVrQuality";
import { useMmdVrStore, type MmdVrLightPreset, type MmdVrMaterialState } from "../mmdVrStore";
import { useMmdVrTheme } from "../mmdVrTheme";
import { prepareMmdVrModel } from "../prepareMmdVrModel";
import { getMmdVrControllerColliderMatrices } from "../mmdVrControllerColliders";
import { getMmdVrHandColliderMatrices } from "../mmdVrHandColliders";
import {
  clearMmdVrHapticContacts,
  MMD_VR_HAPTIC_POLL_INTERVAL,
  setMmdVrHapticContacts,
} from "../mmdVrHaptics";
import { transformRequiresPhysicsReseed } from "../mmdVrPhysicsReseed";

const OBJECT_DEFAULT_Z = -2.2;

type MmdVrObjectRef = {
  group: THREE.Group;
  name: string;
  revoke: () => void;
  defaultPosition: [number, number, number];
};

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
    ambient: 0.55,
    ambientColor: "#dce7ff",
    sun: 1.05,
    sunColor: "#fff4e8",
    hemi: 0.35,
    hemiSky: "#b8c8e0",
    hemiGround: "#1a2230",
    sunPos: [3.2, 6.5, 2.4],
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
    ambient: 0.28,
    ambientColor: "#c8d5ef",
    sun: 1.45,
    sunColor: "#fff1df",
    hemi: 0.2,
    hemiSky: "#9eb4d5",
    hemiGround: "#090d14",
    sunPos: [4.5, 7, 1.2],
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
}: {
  segments: number;
  shadows: boolean;
  placeMode: boolean;
  floorColor: string;
}) {
  const { accent } = useMmdVrTheme();
  return (
    <group position={[0, -0.02, 0]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow={shadows}
        onPointerDown={(e) => {
          if (!placeMode) return;
          e.stopPropagation();
          const p = e.point;
          useMmdVrStore.getState().requestGroundPlace(p.x, p.z);
        }}
      >
        <circleGeometry args={[8, segments]} />
        {shadows ? (
          <meshStandardMaterial color={floorColor} roughness={0.92} metalness={0.05} depthWrite={false} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        ) : (
          <meshBasicMaterial color={floorColor} depthWrite={false} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
        )}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[3.2, 3.32, Math.max(16, Math.floor(segments / 2))]} />
        <meshBasicMaterial color={accent.gridMajor} transparent opacity={0.4} side={THREE.FrontSide} />
      </mesh>
      {placeMode ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} raycast={() => null}>
          <ringGeometry args={[7.6, 7.95, 48]} />
          <meshBasicMaterial color={accent.marker} transparent opacity={0.35} side={THREE.DoubleSide} />
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

/**
 * Owns MMD runtime (WebGL only), loads session assets once, advances timeline.
 */
export function MmdVrStageContent() {
  const { scene, camera, size, gl } = useThree();
  const { accent } = useMmdVrTheme();
  const mmdPrefs = useMmdVrStore((s) => s.prefs);
  const profile = getMmdVrRenderProfile(mmdPrefs);
  const lightPreset = mmdPrefs.lightPreset;
  const lightCfg = LIGHT_PRESETS[lightPreset] ?? LIGHT_PRESETS.stage;
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
  const objectsRef = useRef<Map<string, MmdVrObjectRef>>(new Map());
  const lastEvaluatedTimeRef = useRef(-Infinity);
  const timeRef = useRef(0);
  const physicsOnlyTimeRef = useRef(0);
  const physicsContactPollRef = useRef(0);
  const hapticContactPollRef = useRef(0);
  const lastPhysicsResetEpochRef = useRef(0);
  const playingRef = useRef(false);
  const loopRef = useRef(false);
  const loadGenRef = useRef(0);
  const loadedKeyRef = useRef<string | null>(null);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const stopPlayingQueuedRef = useRef(false);
  const lastSeekEpochRef = useRef(0);
  const lightingKeyRef = useRef("");
  const lifecycleGenerationRef = useRef(0);
  const physicsOperationCountRef = useRef(0);
  const appliedPhysicsEnabledRef = useRef(false);
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
  const physicsBusy = useMmdVrStore((s) => s.physicsBusy);
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

  const runtime = useMemo(() => {
    const handle = createMmdRuntimeHandle(scene, {
      controllerColliders: getMmdVrControllerColliderMatrices,
      controllerCollidersEnabled: () => useMmdVrStore.getState().physicsControllerCollisions,
      controllerColliderRadius: () => useMmdVrStore.getState().prefs.physicsColliderRadius,
      handColliders: getMmdVrHandColliderMatrices,
      handCollidersEnabled: () => useMmdVrStore.getState().physicsControllerCollisions,
      handColliderRadius: () => Math.max(0.025, useMmdVrStore.getState().prefs.physicsColliderRadius * 0.45),
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
    });
    runtimeRef.current = handle;
    return handle;
  }, [scene]);

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
    if (physicsEnabled === appliedPhysicsEnabledRef.current) return;
    let cancelled = false;
    setPhysicsBusy(true);
    useMmdVrStore.getState().setPhysicsError(null);
    physicsOperationCountRef.current += 1;
    void runtime.setPhysicsEnabled(physicsEnabled).then(() => {
      if (!cancelled) {
        appliedPhysicsEnabledRef.current = physicsEnabled;
        if (physicsEnabled) {
          appliedSelfCollisionRef.current = useMmdVrStore.getState().prefs.physicsDynamicSelfCollision;
        }
        syncModelList();
        syncMaterialModels();
        lastEvaluatedTimeRef.current = -Infinity;
      }
    }).catch((error) => {
      console.error("[mmdVr] physics toggle failed", error);
      if (!cancelled) {
        const fatal = isMmdRuntimeRebuildError(error);
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
      if (!cancelled && physicsOperationCountRef.current === 0) setPhysicsBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [physicsEnabled, runtime, setPhysicsBusy]);

  useEffect(() => {
    if (!useMmdVrStore.getState().physicsEnabled) return;
    if (physicsDynamicSelfCollision === appliedSelfCollisionRef.current) return;
    let cancelled = false;
    setPhysicsBusy(true);
    useMmdVrStore.getState().setPhysicsError(null);
    physicsOperationCountRef.current += 1;
    void runtime.rebuildPhysics().then(() => {
      if (!cancelled) {
        appliedSelfCollisionRef.current = physicsDynamicSelfCollision;
        syncModelList();
        syncMaterialModels();
        lastEvaluatedTimeRef.current = -Infinity;
      }
    }).catch((error) => {
      console.error("[mmdVr] self-collision rebuild failed", error);
      if (!cancelled) {
        const fatal = isMmdRuntimeRebuildError(error);
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
      if (!cancelled && physicsOperationCountRef.current === 0) setPhysicsBusy(false);
    });
    return () => {
      cancelled = true;
    };
  }, [physicsDynamicSelfCollision, runtime, setPhysicsBusy]);

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
        disposeAllObjects();
        if (runtimeRef.current === runtime) runtimeRef.current = null;
        loadedKeyRef.current = null;
      });
    };
  }, [runtime]);

  function applyLighting() {
    const sun = sunRef.current;
    if (!sun) return;
    const key = `${lightPreset}|${profile.shadows}|${sun.uuid}`;
    if (lightingKeyRef.current === key) return;
    lightingKeyRef.current = key;
    const cfg = LIGHT_PRESETS[useMmdVrStore.getState().prefs.lightPreset] ?? LIGHT_PRESETS.stage;
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
  }, [runtime, lightPreset, profile.shadows]);

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    camera.far = viewDistance;
    camera.updateProjectionMatrix();
  }, [camera, viewDistance]);

  useLayoutEffect(() => {
    const previousToneMapping = gl.toneMapping;
    const previousExposure = gl.toneMappingExposure;
    gl.toneMapping = THREE.LinearToneMapping;
    return () => {
      gl.toneMapping = previousToneMapping;
      gl.toneMappingExposure = previousExposure;
    };
  }, [gl]);

  useLayoutEffect(() => {
    gl.toneMappingExposure = mmdPrefs.exposure;
  }, [gl, mmdPrefs.exposure]);

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
    const list = [...objectsRef.current.entries()].map(([id, entry]) => ({
      id,
      name: entry.name,
      visible: entry.group.visible,
      scale: entry.group.scale.x,
      rotationY: entry.group.rotation.y,
    }));
    setObjects(list);
  }

  function disposeGroupResources(group: THREE.Group) {
    group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        if (!material) continue;
        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        material.dispose();
      }
    });
  }

  function disposeObjectEntry(id: string, entry: MmdVrObjectRef) {
    scene.remove(entry.group);
    disposeGroupResources(entry.group);
    entry.revoke();
    objectsRef.current.delete(id);
  }

  function disposeAllObjects() {
    for (const [id, entry] of [...objectsRef.current.entries()]) disposeObjectEntry(id, entry);
  }

  async function loadObjectSlot(
    slot: MmdVrObjectSlot,
    id: string,
    offsetX: number,
    isStale: () => boolean,
  ): Promise<void> {
    const { loader, url, revoke } = createMmdVrGltfLoader(slot.objectFile, slot.companionFiles);
    return new Promise<void>((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          if (isStale()) {
            revoke();
            disposeGroupResources(gltf.scene);
            resolve();
            return;
          }
          const group = gltf.scene;
          group.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.frustumCulled = false;
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          group.position.set(offsetX, 0, OBJECT_DEFAULT_Z);
          scene.add(group);
          objectsRef.current.set(id, {
            group,
            name: slot.objectFile.name.replace(/\.(gltf|glb)$/i, ""),
            revoke,
            defaultPosition: [offsetX, 0, OBJECT_DEFAULT_Z],
          });
          resolve();
        },
        undefined,
        (error) => {
          revoke();
          reject(error instanceof Error ? error : new Error(String(error)));
        },
      );
    });
  }

  useEffect(() => {
    if (seekEpoch === lastSeekEpochRef.current) return;
    lastSeekEpochRef.current = seekEpoch;
    const dur = runtime.duration;
    timeRef.current = dur > 0 ? Math.min(Math.max(0, seekSeconds), dur) : 0;
    setMmdVrClockTime(timeRef.current, true);
  }, [seekEpoch, seekSeconds, runtime]);

  // Load once per runtime + session asset key (not on i18n change).
  useEffect(() => {
    const slots = getMmdVrSessionAssets();
    const loadKey = slots
      .map((slot) => slot.kind === "model"
        ? `m:${slot.modelFile.name}:${slot.modelFile.size}:${slot.bodyMotionFile?.name ?? ""}`
        : `o:${slot.objectFile.name}:${slot.objectFile.size}`)
      .join("|");

    if (!slots.length) {
      setStatusLine(labelsRef.current.empty);
      setModels([]);
      setMaterialModels({});
      setObjects([]);
      setDuration(0);
      resetMmdVrClock();
      return;
    }

    if (loadedKeyRef.current === loadKey && (runtime.listModels().length > 0 || objectsRef.current.size > 0)) {
      syncModelList();
      syncObjects();
      return;
    }

    const gen = ++loadGenRef.current;
    let cancelled = false;
    setStatusLine(labelsRef.current.loading);
    queueMicrotask(() => void (async () => {
      if (cancelled || gen !== loadGenRef.current) return;
      try {
        const failures: string[] = [];
        const modelSlots = slots.filter((slot): slot is MmdVrModelSlot => slot.kind === "model");
        let modelIndex = 0;
        for (const slot of modelSlots) {
          if (cancelled || gen !== loadGenRef.current) return;
          const offsetX = (modelIndex - (modelSlots.length - 1) / 2) * 1.1;
          try {
            const report = await runtime.addModel(slot.modelFile, slot.companionFiles, {
              physics: false,
              transform: { positionX: offsetX },
            });
            if (slot.bodyMotionFile) {
              try {
                await runtime.loadMotion(slot.bodyMotionFile, "body", report.modelId);
              } catch (error) {
                failures.push(`${slot.modelFile.name} (${slot.bodyMotionFile.name})`);
                console.warn(`[mmdVr] body motion failed for ${slot.modelFile.name}`, error);
              }
            }
            if (slot.faceMotionFile) {
              try {
                await runtime.loadMotion(slot.faceMotionFile, "face", report.modelId);
              } catch (error) {
                failures.push(`${slot.modelFile.name} (${slot.faceMotionFile.name})`);
                console.warn(`[mmdVr] face motion failed for ${slot.modelFile.name}`, error);
              }
            }
          } catch (error) {
            failures.push(slot.modelFile.name);
            console.error(`[mmdVr] model load failed: ${slot.modelFile.name}`, error);
          }
          modelIndex += 1;
        }
        const objectSlots = slots.filter((slot): slot is MmdVrObjectSlot => slot.kind === "object");
        let objectIndex = 0;
        for (const slot of objectSlots) {
          if (cancelled || gen !== loadGenRef.current) return;
          const id = `object:${relativePath(slot.objectFile)}`;
          const offsetX = (objectIndex - (objectSlots.length - 1) / 2) * 1.4;
          try {
            await loadObjectSlot(slot, id, offsetX, () => cancelled || gen !== loadGenRef.current);
          } catch (error) {
            failures.push(slot.objectFile.name);
            console.error(`[mmdVr] object load failed: ${slot.objectFile.name}`, error);
          }
          objectIndex += 1;
        }
        if (cancelled || gen !== loadGenRef.current) return;
        loadedKeyRef.current = loadKey;
        timeRef.current = 0;
        // Force an evaluation on the next frame so static models (no motion,
        // no physics) are posed/bound after the async load finishes.
        lastEvaluatedTimeRef.current = -Infinity;
        syncModelList();
        syncMaterialModels();
        syncObjects();
        setStatusLine(failures.length ? `${labelsRef.current.failed}: ${failures.join(", ").slice(0, 36)}` : null);
        setMmdVrClockTime(0, true);
        if (runtime.duration > 0) setPlaying(true);
      } catch (err) {
        if (cancelled || gen !== loadGenRef.current) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[mmdVr] load failed", err);
        setStatusLine(`${labelsRef.current.failed}: ${msg.slice(0, 28)}`);
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
  }, [runtime, setDuration, setMaterialModels, setModels, setObjects, setPlaying, setStatusLine]);

  useFrame((_, delta) => {
    applyLighting();

    const store = useMmdVrStore.getState();
    let physicsReseedNeeded = false;
    const removals = store.physicsBusy ? [] : store.takeModelRemovals();
    if (removals.length) {
      for (const id of removals) {
        const objectEntry = objectsRef.current.get(id);
        if (objectEntry) disposeObjectEntry(id, objectEntry);
        else runtime.removeModel(id);
      }
      syncModelList();
      syncMaterialModels();
      syncObjects();
    }
    const toggles = store.physicsBusy ? [] : store.takeVisibilityToggles();
    if (toggles.length) {
      for (const id of toggles) {
        const objectEntry = objectsRef.current.get(id);
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
    if (place) {
      const models = runtime.listModels();
      const objectIds = [...objectsRef.current.keys()];
      const targetId =
        (store.placeModelId && (models.some((m) => m.id === store.placeModelId) || objectIds.includes(store.placeModelId))
          ? store.placeModelId
          : models.find((m) => m.visible)?.id) ?? models[0]?.id ?? objectIds[0];
      if (targetId) {
        const objectEntry = objectsRef.current.get(targetId);
        if (objectEntry) {
          objectEntry.group.position.set(place.x, 0, place.z);
        } else {
          runtime.setModelTransform(targetId, {
            positionX: place.x,
            positionY: 0,
            positionZ: place.z,
          });
          physicsReseedNeeded = true;
        }
        if (store.placeModelId !== targetId) {
          store.setPlaceModelId(targetId);
        }
      }
    }

    const transformRequests = store.physicsBusy ? [] : store.takeModelTransformRequests();
    if (transformRequests.length) {
      const models = runtime.listModels();
      for (const request of transformRequests) {
        const objectEntry = objectsRef.current.get(request.id);
        if (objectEntry) {
          if (request.reset) {
            objectEntry.group.position.set(...objectEntry.defaultPosition);
            objectEntry.group.scale.setScalar(1);
            objectEntry.group.rotation.y = 0;
          } else {
            if (request.scale != null) objectEntry.group.scale.setScalar(request.scale);
            if (request.rotationY != null) objectEntry.group.rotation.y = request.rotationY;
          }
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
      physicsOnlyTimeRef.current = 0;
    }

    const rt = runtimeRef.current;
    if (!rt) return;
    const duration = rt.duration;
    const simulationDelta = clampMmdVrSimulationDelta(delta);
    if (playingRef.current && duration > 0) {
      timeRef.current += simulationDelta;
      if (timeRef.current >= duration) {
        if (loopRef.current) {
          timeRef.current = 0;
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
    // No-motion physics: let Bullet settle for a few seconds (gravity sags
    // clothes), then freeze the timeline so deltaSeconds=0 — Bullet stops
    // stepping and the bone-feedback loop can't sustain oscillation.
    // Exception: when controller collisions are on, keep stepping so the
    // user can interact with cloth.
    const controllerCollisionsActive = store.physicsEnabled
      && !store.physicsBusy
      && store.physicsControllerCollisions;
    if (store.physicsEnabled && !store.physicsBusy && duration <= 0) {
      if (controllerCollisionsActive) {
        physicsOnlyTimeRef.current += simulationDelta;
      } else {
        physicsOnlyTimeRef.current = Math.min(physicsOnlyTimeRef.current + simulationDelta, 5);
      }
    } else if (!store.physicsEnabled || duration > 0) {
      physicsOnlyTimeRef.current = 0;
    }
    setMmdVrClockTime(timeRef.current);

    const perspective = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(1, size.height);
    if (perspective.isPerspectiveCamera && Math.abs(perspective.aspect - aspect) > 1e-5) {
      perspective.aspect = aspect;
      perspective.updateProjectionMatrix();
    }
    const evaluationTime = duration > 0 ? timeRef.current : physicsOnlyTimeRef.current;
    const physicsOn = physicsEnabled && !physicsBusy;
    // Paused + no physics: bone/IK/morph evaluation would recompute identical
    // results, so skip it and keep rendering the frozen pose. Physics must
    // keep stepping when enabled so controller collisions stay alive, and a
    // seek while paused must still re-evaluate the target frame once.
    const timeChanged = Math.abs(evaluationTime - lastEvaluatedTimeRef.current) > 1e-5;
    if (playingRef.current || physicsOn || timeChanged) {
      rt.update(evaluationTime, physicsOn, perspective, aspect, false);
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
      {mmdPrefs.stageSkyEnabled ? (
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
      />
      {mmdPrefs.stageLightPoolEnabled ? (
        <StageLightPool color={lightCfg.poolColor} opacity={Math.min(0.14, rimIntensity * 0.08)} />
      ) : null}
      {profile.showGrid ? (
        <gridHelper
          args={[12, 12, accent.gridMajor, accent.gridMinor]}
          position={[0, 0.01, 0]}
        />
      ) : null}
    </>
  );
}
