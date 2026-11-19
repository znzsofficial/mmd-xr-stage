import * as THREE from "three";
import { relativePath } from "../mmdImport/folderFiles";
import { useBackpack, type BackpackCommand, type BackpackLive } from "./backpack";
import type { AssetLoadFailure, AssetLoadTask } from "./mmdAssetLoadQueue";
import type { MmdProjectModelAssets, MmdRuntimeHandle } from "./mmdRuntime/mmdRuntime";
import { MMD_VR_MAX_MODELS, MMD_VR_MAX_OBJECTS, type MmdVrAssetSlot, type MmdVrObjectSlot } from "./mmdVrAssets";
import { createMmdVrGltfLoader } from "./mmdVrGltf";
import { createModelLoadTask } from "./modelLoadTask";
import { setObjectHeadingDegrees } from "./objectHeading";
import { prepareStageObject } from "./prepareStageObject";
import { firstCharacterScale } from "./firstCharacterScale";
import { wristSockets } from './play/wristSocket';
import { useStagePlay } from './play/stagePlay';
import { applySavedObject, snapshotModel, snapshotObject, type SavedObject, type StageSnapshot } from "./stageSnapshot";

type StageObject = {
  slot: MmdVrObjectSlot; group: THREE.Group; name: string; revoke: () => void; defaultPosition: [number, number, number];
};
const abort = () => new DOMException("Stage changed", "AbortError");
const savedModel = (m: MmdProjectModelAssets) => snapshotModel({ file: m.modelFile, transform: m.transform,
  visible: m.visible, materialVisible: m.materialVisible, materialOverrides: m.materialOverrides });
const modelBindings = (m: MmdProjectModelAssets) => ({ body: m.bodyMotionFile ?? undefined, face: m.faceMotionFile ?? undefined });

function disposeGroup(group: THREE.Group) {
  const resources = new Set<THREE.BufferGeometry | THREE.Texture | THREE.Material>();
  group.traverse(child => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    resources.add(mesh.geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (!material) continue;
      resources.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.add(value);
    }
  });
  for (const resource of resources) resource.dispose();
}

// Rest-geometry proxy: measure only when a root first goes live. Applying the
// current root matrix later tracks move/turn/scale without skinning vertices.
const localBounds = new WeakMap<THREE.Object3D, THREE.Box3>();
function liveBounds(root: THREE.Object3D | null) {
  if (!root) return undefined;
  let local = localBounds.get(root);
  if (!local) {
    root.updateWorldMatrix(true, true);
    const inverse = root.matrixWorld.clone().invert(), matrix = new THREE.Matrix4(), box = new THREE.Box3();
    local = new THREE.Box3();
    root.traverse(child => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry?.attributes.position) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      if (!mesh.geometry.boundingBox) return;
      box.copy(mesh.geometry.boundingBox).applyMatrix4(matrix.multiplyMatrices(inverse, child.matrixWorld));
      local!.union(box);
    });
    localBounds.set(root, local);
  }
  if (local.isEmpty()) return undefined;
  root.updateWorldMatrix(true, false);
  const world = local.clone().applyMatrix4(root.matrixWorld);
  const center = world.getCenter(new THREE.Vector3()).toArray(), size = world.getSize(new THREE.Vector3()).toArray();
  return [...center, ...size].every(Number.isFinite) ? { center, size } : undefined;
}

/** One room's owned actors. File references and snapshots, never their renderables, survive a switch. */
export function createStageActors(scene: THREE.Scene, runtime: MmdRuntimeHandle, physicsEnabled: () => boolean, currentTime: () => number) {
  const objects = new Map<string, StageObject>();
  const committedModels = new Set<string>();
  const repairs = new Map<File, AssetLoadFailure>();
  let nextRepair = 0;
  const forgotten = new Set<File>(); // Retired restore tasks cannot resurrect a put-away item on retry.
  const models = () => runtime.exportProjectModels().filter(m => committedModels.has(m.id));
  let nextObject = 0;

  function releaseObject(id: string, obj: StageObject) {
    objects.delete(id);
    scene.remove(obj.group);
    disposeGroup(obj.group);
    obj.revoke();
  }

  async function loadObject(slot: MmdVrObjectSlot, x: number, stale: () => boolean, saved?: SavedObject, place?: Extract<BackpackCommand, {type:"place"}>) {
    const { loader, url, revoke } = createMmdVrGltfLoader(slot.objectFile, slot.companionFiles);
    let group: THREE.Group | undefined;
    try {
      group = (await loader.loadAsync(url)).scene;
      if (stale()) throw abort();
      prepareStageObject(group);
      const defaultPosition: [number, number, number] = [x, 0, place?.z ?? -2.2];
      group.position.set(...defaultPosition);
      if (saved) applySavedObject(group, saved);
      if (place) {
        group.position.set(place.x, 0, place.z);
        setObjectHeadingDegrees(group, place.yaw);
        group.visible = true;
      }
      scene.add(group);
      objects.set(`object:${++nextObject}`, { group, slot, revoke, defaultPosition, name: slot.objectFile.name.replace(/\.(gltf|glb)$/i, "") });
    } catch (error) {
      if (group) disposeGroup(group);
      revoke();
      throw error;
    }
  }

  function capture(): Pick<StageSnapshot, "assets" | "models" | "objects"> {
    const active = models();
    // Bag slots resolve companions from the current page library on restore.
    // Keeping the old whole-library array here would pin unrelated, deleted files
    // in every inactive room. Explicit non-bag sessions still own their files.
    const bagFiles = new Set(useBackpack.getState().entries.map(e => e.file));
    const assets: MmdVrAssetSlot[] = active.map(m => ({ kind: "model", modelFile: m.modelFile,
      companionFiles: bagFiles.has(m.modelFile) ? [] : m.companionFiles, bodyMotionFile: m.bodyMotionFile, faceMotionFile: m.faceMotionFile }));
    return { assets: [...assets, ...Array.from(objects.values(), o => bagFiles.has(o.slot.objectFile) ? { ...o.slot, companionFiles: [] } : o.slot)], models: active.map(savedModel),
      objects: Array.from(objects.values(), o => snapshotObject(o.slot.objectFile, o.group)) };
  }

  function publishLive() {
    const s = useBackpack.getState(), ids = new Map(s.entries.map(e => [e.file, e.id]));
    const live: Record<string, BackpackLive> = {};
    const bindings = { ...s.bindings };
    for (const m of models()) {
      const id = ids.get(m.modelFile);
      if (!id) continue;
      const t = m.transform;
      const root = runtime.getModelRoot(m.id), bounds = liveBounds(root);
      const sockets = root ? wristSockets(root) : {};
      bindings[id] = modelBindings(m);
      live[id] = { runtimeId: m.id, position: [t.positionX, t.positionY, t.positionZ], visible: m.visible, wrists:{left:!!sockets.left,right:!!sockets.right}, ...(bounds && { bounds }) };
    }
    for (const [runtimeId, o] of objects) {
      const id = ids.get(o.slot.objectFile);
      if (!id) continue;
      const bounds = liveBounds(o.group);
      live[id] = { runtimeId, position: o.group.position.toArray(), visible: o.group.visible, ...(bounds && { bounds }) };
    }
    // The same character may have different actions in two rooms. Publish the
    // files actually bound to the active instance atomically with its new id.
    useBackpack.setState({ live, bindings });
    const carrier=useStagePlay.getState().character?.assetId;
    if(carrier && live[carrier]?.visible===false)useStagePlay.getState().stow();
  }

  function putAway(runtimeId: string) {
    const obj = objects.get(runtimeId), m = models().find(m => m.id === runtimeId);
    if (!m && !obj) return;
    const saved = m ? savedModel(m) : snapshotObject(obj!.slot.objectFile, obj!.group);
    const id = useBackpack.getState().entries.find(e => e.file === saved.file)?.id;
    if (id && useStagePlay.getState().character?.assetId === id) useStagePlay.getState().stow();
    if (id) useBackpack.setState(s => ({ stored: { ...s.stored, [id]: saved }, bindings: m ? { ...s.bindings, [id]: modelBindings(m) } : s.bindings }));
    forgotten.add(saved.file);
    repairs.delete(saved.file);
    if (obj) releaseObject(runtimeId, obj);
    else { committedModels.delete(runtimeId); runtime.removeModel(runtimeId); }
  }

  function companions(file: File, fallback: File[]) {
    const bag = useBackpack.getState();
    return bag.entries.some(e => e.file === file) ? [...bag.files] : fallback;
  }

  function warn(file: File, message: string) {
    repairs.set(file, { id: repairs.get(file)?.id ?? `repair:${++nextRepair}`, phase: "model", fileName: relativePath(file), message });
  }

  function repairTasks(stale: () => boolean): AssetLoadTask[] {
    return Array.from(repairs, ([file, failure]) => ({ ...failure, run: async () => {
      const old = models().find(m => m.modelFile === file);
      if (!old) { repairs.delete(file); return; }
      const task = createModelLoadTask(runtime, { kind: "model", modelFile: file, companionFiles: companions(file, old.companionFiles), bodyMotionFile: old.bodyMotionFile },
        { physicsEnabled, isStale: stale, saved: savedModel(old), transform: old.transform });
      try {
        const warnings = await task.load();
        if (stale() || !task.modelId) throw abort();
        // A failed repair leaves the previous instance (including current
        // user-chosen motions) visible; swap only once fully rebound.
        runtime.setModelVisible(task.modelId, false);
        if (warnings?.length) throw new Error(warnings.join("\n"));
        if (old.bodyMotionFile) await task.loadMotion(old.bodyMotionFile, "body");
        if (old.faceMotionFile) await task.loadMotion(old.faceMotionFile, "face");
        if (stale()) throw abort();
        runtime.setModelVisible(task.modelId, old.visible);
        runtime.removeModel(old.id);
        committedModels.delete(old.id); committedModels.add(task.modelId);
        repairs.delete(file);
      } catch (error) {
        if (task.modelId) runtime.removeModel(task.modelId);
        if (!stale()) warn(file, error instanceof Error ? error.message : String(error));
        throw error;
      }
    } }));
  }

  function restoreTasks(slots: readonly MmdVrAssetSlot[], saved: StageSnapshot | null, stale: () => boolean): AssetLoadTask[] {
    const tasks: AssetLoadTask[] = [], chars = slots.filter(s => s.kind === "model"), props = slots.filter(s => s.kind === "object");
    chars.forEach((slot, i) => {
      const id = `model:${i}`, skip = () => forgotten.has(slot.modelFile);
      const task = createModelLoadTask(runtime, slot, { physicsEnabled, isStale: () => stale() || skip(),
        companions: () => companions(slot.modelFile, slot.companionFiles),
        transform: { positionX: (i - (chars.length - 1) / 2) * 1.1 }, saved: saved?.models.find(m => m.file === slot.modelFile) });
      tasks.push({ id, fileName: relativePath(slot.modelFile), phase: "model", run: async () => {
        if (skip()) return;
        const previous = task.modelId;
        const warnings = await task.load();
        if (previous) committedModels.delete(previous);
        if (task.modelId) committedModels.add(task.modelId);
        if (warnings?.length) warn(slot.modelFile, warnings.join("\n"));
      } });
      for (const [phase, file] of [["body", slot.bodyMotionFile], ["face", slot.faceMotionFile]] as const) {
        if (file) tasks.push({ id: `${id}:${phase}`, requires: id, phase, fileName: `${relativePath(slot.modelFile)} → ${relativePath(file)}`,
          run: async () => {
            if (skip()) return;
            const target = models().find(m => m.modelFile === slot.modelFile);
            if (!target) throw new Error("Model not loaded");
            await runtime.loadMotion(file, phase, target.id, stale);
          } });
      }
    });
    props.forEach((slot, i) => tasks.push({ id: `object:${i}`, fileName: relativePath(slot.objectFile), phase: "object",
      run: () => loadObject({ ...slot, companionFiles: companions(slot.objectFile, slot.companionFiles) }, (i - (props.length - 1) / 2) * 1.4,
        stale, saved?.objects.find(o => o.file === slot.objectFile)) }));
    return tasks;
  }

  async function execute(command: BackpackCommand, stale: () => boolean, work?: import('./placementWork').PlacementWork) {
    const s = useBackpack.getState(), entry = s.entries.find(e => e.id === command.id);
    if (!entry || entry.kind === "motion" || stale()) throw abort();
    const active = models(), model = active.find(m => m.modelFile === entry.file);
    const object = [...objects.entries()].find(([,o]) => o.slot.objectFile === entry.file);
    const runtimeId = model?.id ?? object?.[0];
    if (command.type === "remove") {
      if (runtimeId) putAway(runtimeId);
      return;
    }
    if (command.type === "motion") {
      if (!model) throw new Error("Model not loaded");
      await runtime.loadMotion(command.file, command.kind, model.id, stale);
      if (stale()) throw abort();
      return;
    }
    const {x, z, yaw} = command;
    const transform = { positionX:x, positionY:0, positionZ:z, rotationY:yaw };
    if (model) {
      runtime.setModelTransform(model.id, transform);
      runtime.setModelVisible(model.id, true);
      return;
    }
    if (object) {
      object[1].group.position.set(x, 0, z);
      setObjectHeadingDegrees(object[1].group, yaw);
      object[1].group.visible = true;
      return;
    }
    const companionFiles = s.files.length ? [...s.files] : [entry.file], saved = s.stored[entry.id];
    if (entry.kind === "object") {
      if (objects.size >= MMD_VR_MAX_OBJECTS) throw new Error("Stage is full");
      await loadObject({ kind:"object", objectFile:entry.file, companionFiles }, x, stale, saved && "quaternion" in saved ? saved : undefined, command);
      return;
    }
    if (active.length >= MMD_VR_MAX_MODELS) throw new Error("Stage is full");
    const binding = s.bindings[entry.id];
    const task = createModelLoadTask(runtime, { kind:"model", modelFile:entry.file, companionFiles, bodyMotionFile: binding?.body ?? null }, {
      work, transform, physicsEnabled, isStale: stale, saved: saved && "transform" in saved ? { ...saved, transform:{...saved.transform, ...transform}, visible:true } : undefined,
    });
    try {
      const warnings = await task.load();
      if (stale() || !task.modelId) throw abort();
      const scale = saved ? undefined : firstCharacterScale(runtime.getModelRoot(task.modelId));
      if (scale != null) runtime.setModelTransform(task.modelId, { scale });
      // Keep a provisional actor out of snapshots and ray selection until its bindings also succeed.
      if (binding?.body || binding?.face) {
        runtime.setModelVisible(task.modelId, false);
        if (binding.body) await task.loadMotion(binding.body, "body");
        if (binding.face) await task.loadMotion(binding.face, "face");
        if (stale()) throw abort();
        runtime.setModelVisible(task.modelId, true);
      }
      if (scale != null && physicsEnabled()) runtime.resetPhysics(currentTime(), task.modelId);
      committedModels.add(task.modelId);
      if (warnings?.length) warn(entry.file, warnings.join("\n"));
      return warnings?.join("\n"); // Texture diagnostics allow the same partial preview as initial restore.
    } catch (error) {
      if (task.modelId) runtime.removeModel(task.modelId);
      throw error;
    }
  }

  return { objects, capture, execute, publishLive, putAway, restoreTasks, repairTasks, repairFailures: () => [...repairs.values()],
    disposeObjects: () => { for (const [id, obj] of objects) releaseObject(id, obj); } };
}
