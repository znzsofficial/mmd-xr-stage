// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
import { MmdVrStageContent, MmdVrStageRoom } from "./MmdVrStage";
import { createMmdRuntimeHandle } from "../mmdRuntime/mmdRuntime";
import { beginMmdVrAssetSession, endMmdVrAssetSession } from "../mmdVrAssets";
import { useMmdVrStore } from "../mmdVrStore";
import { getMmdVrClock } from "../mmdVrClock";
import { clearBackpack, prepareBackpackEntry, syncBackpackFiles, useBackpack } from "../backpack";
import { ThreeMmdLoader, type ThreeMmdModel } from "@yohawing/three-mmd-loader";
import { createMmdVrGltfLoader } from "../mmdVrGltf";
import * as bullet from '../mmdRuntime/bulletModule';
import {xrRoomRestoreTiming} from '../roomRestoreTiming';

const harness = vi.hoisted(() => ({
  three: {} as Record<string, unknown>,
  frame: null as null | ((state: unknown, delta: number) => void),
}));
vi.mock("@react-three/fiber", () => ({
  useThree: () => harness.three,
  useFrame: (callback: typeof harness.frame) => { harness.frame = callback; },
}));
vi.mock("../mmdVrGltf", () => ({ createMmdVrGltfLoader: vi.fn() }));
vi.mock("../mmdRuntime/mmdRuntime", () => ({ createMmdRuntimeHandle: vi.fn(), isMmdRuntimeRebuildError: () => false }));

function RoomHarness(props: Parameters<typeof MmdVrStageRoom>[0]) {
  MmdVrStageRoom(props);
  return null;
}
function LifecycleHarness() {
  const room = MmdVrStageContent();
  return <RoomHarness key={room.key} {...room.props} />;
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); endMmdVrAssetSession(); clearBackpack(); });

it("keeps paused motion and HUD time fixed while forwarding the frame delta, and reseeds on scrub and loop", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  harness.three = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), size: { width: 640, height: 480 }, gl: {} };
  const update = vi.fn();
  const runtime = { duration: 2, update, dispose: vi.fn(), listModels: () => [], exportProjectModels: () => [], getControllerContactCount: () => 0, setPhysicsEnabled: vi.fn(async () => {}) };
  vi.mocked(createMmdRuntimeHandle).mockReturnValue(runtime as unknown as ReturnType<typeof createMmdRuntimeHandle>);
  const s = useMmdVrStore.getState(); s.openOverlay();
  useMmdVrStore.setState({ playing: false, loop: true, physicsEnabled: true, physicsBusy: false });
  const root = createRoot(document.createElement("div"));
  const frame = async () => { await act(async () => harness.frame?.({}, 1 / 90)); return update.mock.lastCall!; };
  try {
    await act(async () => root.render(<LifecycleHarness />));
    await act(async () => s.requestSeek(0.75));
    expect((await frame())[6]).toBe(true);
    const paused = await frame();
    expect([paused[0], paused[1], paused[5], paused[6]]).toEqual([0.75, true, 1 / 90, false]);
    expect(getMmdVrClock().time).toBe(0.75);
    await act(async () => useMmdVrStore.setState({presentation:'screen'}));
    expect((await frame())[5]).toBe(0);
    await act(async () => useMmdVrStore.setState({presentation:'xr'}));
    await act(async () => { s.setPlaying(true); s.requestSeek(1.999); });
    expect((await frame())[0]).toBe(1.999);
    const loop = await frame(); expect([loop[0], loop[6]]).toEqual([0, true]);
    const play = await frame(); expect([play[0], play[5], play[6]]).toEqual([1 / 90, 1 / 90, false]);
  } finally { await act(async () => root.unmount()); s.closeOverlay(); }
});

it("retains the committed runtime and evaluates a cold-loaded static model on the first frame under StrictMode", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  harness.three = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), size: { width: 640, height: 480 }, gl: {} };
  const runtimes: { models: { id: string; name: string; visible: boolean; transform: { scale: number; rotationY: number } }[]; addModel: ReturnType<typeof vi.fn>; removeModel: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; dispose: ReturnType<typeof vi.fn> }[] = [];
  vi.mocked(createMmdRuntimeHandle).mockImplementation(() => {
    const models: typeof runtimes[number]["models"] = [];
    const runtime = {
      models, duration: 0,
      addModel: vi.fn(async () => {
        models.push({ id: "cold", name: "cold.pmx", visible: true, transform: { scale: 1, rotationY: 0 } });
        return { modelId: "cold", missingTextures: [], textureWarnings: [] };
      }),
      removeModel: vi.fn(() => { models.length = 0; }),
      listModels: () => models,
      exportProjectModels: () => [],
      update: vi.fn(), dispose: vi.fn(),
    };
    runtimes.push(runtime);
    return runtime as unknown as ReturnType<typeof createMmdRuntimeHandle>;
  });
  const store = useMmdVrStore.getState();
  store.openOverlay();
  useMmdVrStore.setState({ physicsEnabled: false, physicsBusy: false, physicsDebugEnabled: false, playing: false, resumeStage: null });
  const file = new File(["pmx"], "cold.pmx");
  beginMmdVrAssetSession([{ kind: "model", modelFile: file, companionFiles: [file], bodyMotionFile: null }]);
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(<StrictMode><LifecycleHarness /></StrictMode>));
    expect(runtimes).toHaveLength(2);
    const committed = runtimes.find((runtime) => runtime.addModel.mock.calls.length > 0)!;
    expect(committed.addModel).toHaveBeenCalledOnce();
    expect(committed.removeModel).not.toHaveBeenCalled();
    expect(useMmdVrStore.getState().models).toHaveLength(1);
    expect(useMmdVrStore.getState().assetLoad.failures).toHaveLength(0);
    await act(async () => harness.frame?.({}, 1 / 90));
    expect(committed.update).toHaveBeenCalledOnce();
    expect(committed.update.mock.calls[0][0]).toBe(0);
    expect(committed.dispose).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    store.closeOverlay();
  }
  expect(runtimes.filter((runtime) => runtime.dispose.mock.calls.length)).toHaveLength(1);
});

function loadedCharacter() {
  const mesh = new THREE.SkinnedMesh(new THREE.BoxGeometry(1, 2, .5), new THREE.MeshBasicMaterial({ name: "hair" }));
  mesh.position.y = 1;
  mesh.bind(new THREE.Skeleton([]));
  const root = new THREE.Group(); root.add(mesh);
  return { root, mesh, runtime: { dispose: vi.fn() }, setAnimation: vi.fn(), update: vi.fn(), diagnostics: {textures: []},
    outlineMeshes: [], renderOrderMeshes: [] } as unknown as ThreeMmdModel & { runtime: { dispose: () => void } };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function setupBag(files: File[], useMotionCache = false) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const scene = new THREE.Scene();
  harness.three = { scene, camera: new THREE.PerspectiveCamera(), size: { width: 640, height: 480 }, gl:{} };
  const real = await vi.importActual<typeof import("../mmdRuntime/mmdRuntime")>("../mmdRuntime/mmdRuntime");
  vi.mocked(createMmdRuntimeHandle).mockImplementation((scene, opts) => real.createMmdRuntimeHandle(scene, {motionCache: useMotionCache ? opts?.motionCache : undefined}));
  const load = vi.spyOn(ThreeMmdLoader.prototype, "loadModel").mockImplementation(async () => loadedCharacter());
  const motion = vi.spyOn(ThreeMmdLoader.prototype, "loadAnimation").mockResolvedValue({ animation: {
    bytes: new Uint8Array(0), metadata:{ modelName:"", maxFrame:30 }, boneTracks:{}, morphTracks:{}, cameraFrames:[], lightFrames:[], selfShadowFrames:[], propertyFrames:[],
  } } as unknown as Awaited<ReturnType<ThreeMmdLoader["loadAnimation"]>>);
  const store = useMmdVrStore.getState, bag = useBackpack.getState;
  clearBackpack(); syncBackpackFiles(files); prepareBackpackEntry(false);
  store().setPrefs({scenery:"floor"}); store().prepareStage(false); store().openOverlay();
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<StrictMode><LifecycleHarness /></StrictMode>));
  const id = (f: File) => bag().entries.find(e => e.file === f)!.id;
  const place = (f: File, x = 1, yaw = 0) => act(async () => { bag().beginPlace(id(f)); bag().confirmPlace(id(f), x, -2, yaw); });
  const exit = async () => { await act(async () => { store().closeOverlay(); root.unmount(); }); };
  return { scene, root, load, motion, id, place, exit, store, bag };
}
const file = (name: string) => new File([name], name);

it('reports parsed cache hits and rebind work from an actual room-return task without exporting asset identities', async () => {
  const a=file('private-actor.pmx'), vmd=file('private-dance.vmd');
  const {motion,place,exit,store,bag,id}=await setupBag([a,vmd],true);
  try {
    await place(a);await act(async()=>bag().applyMotion(id(a),vmd,'body'));
    await act(async()=>store().setPrefs({scenery:'lawn'}));
    xrRoomRestoreTiming.begin('lawn','floor',true);await act(async()=>store().setPrefs({scenery:'floor'}));
    const e=xrRoomRestoreTiming.frame('floor');expect(e?.success).toBe(true);expect(e?.taskWallMs.body).toBeTypeOf('number');
    expect(e?.motionWork).toEqual([{slot:'body',cache:'hit',evaluator:'other',loadWallMs:expect.any(Number),setAnimationMs:expect.any(Number)}]);
    expect(motion).toHaveBeenCalledOnce();expect(JSON.stringify(e)).not.toContain('private-');
  } finally {xrRoomRestoreTiming.cancel();await exit();}
});

it('arms idle Bullet only after the next frame of a successful fresh manual character placement', async () => {
  const cancel=vi.fn(), arm=vi.spyOn(bullet,'scheduleBulletModuleWarm').mockImplementation(()=>cancel);
  const a=file('actor.pmx'),{place,exit,load,store,bag,id}=await setupBag([a]);
  const frame=()=>act(async()=>harness.frame?.({},1/90));
  try {
    await frame();load.mockRejectedValueOnce(Error('bad model'));await place(a);await frame();
    expect(arm).not.toHaveBeenCalled();await place(a);expect(arm).not.toHaveBeenCalled();
    await frame();expect(arm).toHaveBeenCalledOnce();const eligible=arm.mock.calls[0][0];expect(eligible()).toBe(true);
    await place(a,2);await frame();expect(arm).toHaveBeenCalledOnce();
    await act(async()=>store().setPrefs({scenery:'lawn'}));expect(cancel).toHaveBeenCalled();expect(eligible()).toBe(false);
    await act(async()=>store().setPrefs({scenery:'floor'}));await frame();expect(bag().live[id(a)]).toBeDefined();expect(arm).toHaveBeenCalledOnce();
    await act(async()=>bag().putAway(id(a)));await place(a);await frame();const second=arm.mock.calls[1][0];
    await act(async()=>bag().putAway(id(a)));expect(second()).toBe(false);
  } finally {await exit();}
});

it("keeps neighbors mounted, restores the actor's binding and material after put-away, and continues the actual room", async () => {
  const a = file("a.pmx"), b = file("b.pmx"), vmd = file("dance.vmd"), face = file("smile.vmd");
  const { load, motion, id, place, exit, store, bag, scene } = await setupBag([a,b,vmd,face]);
  try {
    expect(load).not.toHaveBeenCalled();
    await place(a); await place(b);
    const neighbor = bag().live[id(b)].runtimeId, oldId = bag().live[id(a)].runtimeId;
    await place(a, 3, 90);
    expect(load).toHaveBeenCalledTimes(2);
    expect(bag().live[id(a)]).toMatchObject({ runtimeId:oldId, position:[3,0,-2], bounds:{center:[3,1,-2]} });
    expect(bag().live[id(a)].bounds!.size[0]).toBeCloseTo(.5);
    await act(async () => store().setMaterialParam(oldId, "hair", "opacity", .4));
    await act(async () => bag().applyMotion(id(a), vmd, "body"));
    await act(async () => bag().applyMotion(id(a), face, "face"));
    motion.mockRejectedValueOnce(new Error("corrupt vmd"));
    await act(async () => bag().applyMotion(id(a), face, "body"));
    expect(bag().error).toBe("corrupt vmd");
    expect(bag().bindings[id(a)]).toEqual({body:vmd,face});
    await act(async () => bag().putAway(id(a)));
    expect(bag().live[id(a)]).toBeUndefined();
    expect(store().captureStage!()?.assets.map(s => s.kind === "model" && s.modelFile)).toEqual([b]);
    motion.mockRejectedValueOnce(new Error("cannot rebind"));
    await place(a, 2);
    expect(bag().error).toBe("cannot rebind");
    expect(scene.children).toHaveLength(1);
    expect(bag().live[id(b)].runtimeId).toBe(neighbor);
    await place(a, 2);
    const newId = bag().live[id(a)].runtimeId;
    expect(newId).not.toBe(oldId);
    expect(store().materialModels[newId][0].opacity).toBe(.4);
    expect(load.mock.calls.filter(([f]) => f === b)).toHaveLength(1);

    await act(async () => store().setPrefs({scenery:"lawn"}));
    expect(scene.children).toHaveLength(0);
    expect(bag().live).toEqual({});
    await place(a, -3);
    await act(async () => bag().applyMotion(id(a), face, "body"));
    expect(bag().bindings[id(a)].body).toBe(face);
    await act(async () => store().setPrefs({scenery:"floor"}));
    expect(scene.children).toHaveLength(2);
    expect(bag().live[id(a)].position).toEqual([2,0,-2]);
    expect(bag().bindings[id(a)].body).toBe(vmd);
    expect(bag().layouts.lawn?.models[0].transform.positionX).toBe(-3);
  } finally { await exit(); }
  const saved = store().savedStage!;
  expect(saved.scenery).toBe("floor");
  expect(saved.assets.find(s => s.kind === "model" && s.modelFile === a)).toMatchObject({bodyMotionFile:vmd,faceMotionFile:face});
  expect(saved.models.find(m => m.file === a)?.materialOverrides.hair.opacity).toBe(.4);
  const repair = file("replacement.png");
  syncBackpackFiles([a,b,vmd,face,repair]);
  prepareBackpackEntry(true); store().prepareStage(true); store().openOverlay();
  const root = createRoot(document.createElement("div"));
  try {
    await act(async () => root.render(<LifecycleHarness />));
    expect(bag().live[id(a)].position).toEqual([2,0,-2]);
    const continued = store().captureStage!();
    expect(continued?.assets.find(s => s.kind === "model" && s.modelFile === a)).toMatchObject({bodyMotionFile:vmd,faceMotionFile:face,
      companionFiles:[]}); // Inactive room snapshots must not pin unrelated library files.
    const currentRuntime: ReturnType<typeof createMmdRuntimeHandle> = vi.mocked(createMmdRuntimeHandle).mock.results.at(-1)!.value;
    expect(currentRuntime.exportProjectModels().find(m => m.modelFile === a)?.companionFiles).toContain(repair);
  } finally { await act(async () => { store().closeOverlay(); root.unmount(); }); }
});

it("discards a late model on a batched A→B→A, and retains committed actors on close during another drop", async () => {
  const a = file("a.pmx"), late = file("late.pmx");
  const { scene, load, id, place, exit, store, bag } = await setupBag([a,late]);
  const pending = deferred<ThreeMmdModel>();
  const exiting = deferred<ThreeMmdModel>();
  try {
    await place(a);
    load.mockReturnValueOnce(pending.promise);
    await place(late);
    expect(bag().busy).toBe(true);
    await act(async () => { store().setPrefs({scenery:"pool"}); store().setPrefs({scenery:"floor"}); });
    expect(bag().busy).toBe(false);
    const obsolete = loadedCharacter();
    await act(async () => pending.resolve(obsolete));
    expect(obsolete.runtime.dispose).toHaveBeenCalledOnce();
    expect(scene.children).toHaveLength(1);
    expect(Object.keys(bag().live)).toEqual([id(a)]);
    load.mockReturnValueOnce(exiting.promise);
    await place(late);
  } finally { await exit(); }
  const obsolete = loadedCharacter(); await act(async () => exiting.resolve(obsolete));
  expect(obsolete.runtime.dispose).toHaveBeenCalledOnce();
  expect(scene.children).toHaveLength(0);
  expect(store().savedStage?.models.map(m => m.file)).toEqual([a]);
  expect(bag().busy).toBe(false);
  expect(bag().live).toEqual({});
});

it("owns GLB resources through failure, move, put-away, and completion after a scene switch", async () => {
  const prop = file("lamp.glb"), a = file("a.pmx");
  const { scene, id, place, exit, store, bag } = await setupBag([prop,a]);
  const makeProp = () => {
    const group = new THREE.Group();
    const geom = new THREE.BoxGeometry(.5,1,.5), mat = new THREE.MeshBasicMaterial();
    group.add(new THREE.Mesh(geom,mat));
    return {scene:group, dispose:vi.spyOn(geom,"dispose")};
  };
  const revoke = vi.fn(), current = makeProp(), late = makeProp();
  const pending = deferred<{ scene: THREE.Group }>();
  const loadAsync = vi.fn().mockRejectedValueOnce(new Error("invalid GLB")).mockResolvedValueOnce(current).mockReturnValueOnce(pending.promise);
  vi.mocked(createMmdVrGltfLoader).mockReturnValue({ loader:{ loadAsync }, revoke, url:"blob:lamp" } as unknown as ReturnType<typeof createMmdVrGltfLoader>);
  try {
    await place(a);
    const neighbor = bag().live[id(a)].runtimeId;
    await place(prop);
    expect(bag().error).toBe("invalid GLB");
    expect(bag().live[id(prop)]).toBeUndefined();
    expect(revoke).toHaveBeenCalledTimes(1);
    await place(prop); await place(prop, -1.5, 90);
    expect(loadAsync).toHaveBeenCalledTimes(2);
    const runtimeId = bag().live[id(prop)].runtimeId;
    await act(async () => { store().requestModelScale(runtimeId, .5); harness.frame?.({},1 / 90); });
    expect(store().captureStage!()?.objects[0]).toMatchObject({ position:[-1.5,0,-2], scale:[.5,.5,.5] });
    await act(async () => bag().putAway(id(prop)));
    expect(current.dispose).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledTimes(2);
    expect(bag().live[id(a)].runtimeId).toBe(neighbor);
    await place(prop);
    await act(async () => store().setPrefs({scenery:"classroom"}));
    await act(async () => pending.resolve(late));
    expect(scene.children).toHaveLength(0);
    expect(bag().layouts.floor?.objects).toEqual([]);
    expect(late.dispose).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledTimes(3);
  } finally { await exit(); }
});

it("rejects unsupported ground through both the legacy and backpack command paths", async () => {
  const a = file("a.pmx"), { id, place, exit, store, bag, load } = await setupBag([a]);
  try {
    await act(async () => store().setPrefs({scenery:"pool"}));
    await place(a);
    const before = bag().live[id(a)];
    await act(async () => {
      store().setPlaceMode(true); store().requestGroundPlace(-4.34,-5.47); harness.frame?.({},1 / 90);
      bag().beginPlace(id(a)); bag().confirmPlace(id(a), 0,-12,0);
    });
    expect(bag().error).toBeTruthy();
    expect(bag().live[id(a)]).toEqual(before);
    expect(load).toHaveBeenCalledOnce();
    await act(async () => { store().requestGroundPlace(1, -3); harness.frame?.({},1 / 90); });
    expect(bag().live[id(a)].position).toEqual([1,0,-3]);
  } finally { await exit(); }
});

it('persists a gallery performance at its actual height and moves it to the low stage via either placement path',async()=>{
  const a=file('singer.pmx'),{id,exit,store,bag}=await setupBag([a]);
  try{
    await act(async()=>store().setPrefs({scenery:'qinhuai'}));
    await act(async()=>{bag().beginPlace(id(a));bag().confirmPlace(id(a),-6.76,-1.8,90);});
    expect(bag().live[id(a)].position).toEqual([-6.76,2.72,-1.8]);
    await act(async()=>store().setPrefs({scenery:'lawn'}));await act(async()=>store().setPrefs({scenery:'qinhuai'}));
    expect(bag().live[id(a)].position).toEqual([-6.76,2.72,-1.8]);
    await act(async()=>{store().setPlaceMode(true);store().requestGroundPlace(0,-5);harness.frame?.({},1/90);});
    expect(bag().live[id(a)].position).toEqual([0,.42,-5]);
  }finally{await exit();}
});

it("repairs a dynamic actor with texture warnings without replacing either the last clean layout or its neighbor on failure", async () => {
  const a = file("a.pmx"), b = file("b.pmx"), dance = file("dance.vmd");
  const { id, place, exit, store, bag, load, scene } = await setupBag([a,b,dance]);
  try {
    await place(b);
    const damaged = loadedCharacter();
    Object.assign(damaged.diagnostics, { textures: [{ code:"TEXTURE_RESOLVE_FAILED", path:"hair.png" }] });
    load.mockResolvedValueOnce(damaged);
    await place(a);
    const idA = bag().live[id(a)].runtimeId, idB = bag().live[id(b)].runtimeId;
    expect(store().assetLoad.failures[0].message).toContain("hair.png");
    expect(bag().layouts.floor?.models.map(m => m.file)).toEqual([b]);
    await act(async () => { store().setMaterialParam(idA, "hair", "roughness", .3); bag().applyMotion(id(a), dance, "body"); });
    load.mockRejectedValueOnce(new Error("bad repair"));
    await act(async () => store().retryFailedAssets());
    expect(store().assetLoad.failures[0].message).toBe("bad repair");
    expect(bag().live[id(a)].runtimeId).toBe(idA);
    expect(scene.children).toHaveLength(2);
    await act(async () => store().retryFailedAssets());
    expect(store().assetLoad.failures).toEqual([]);
    expect(bag().live[id(a)].runtimeId).not.toBe(idA);
    expect(bag().bindings[id(a)].body).toBe(dance);
    expect(store().materialModels[bag().live[id(a)].runtimeId][0].roughness).toBe(.3);
    expect(bag().live[id(b)].runtimeId).toBe(idB);
    expect(bag().layouts.floor?.models).toHaveLength(2);
    expect(load.mock.calls.filter(([f]) => f === b)).toHaveLength(1);
  } finally { await exit(); }
});

it("fits a fresh humanoid once, then honors the viewer's size on the next drop", async () => {
  const a = file("person.pmx");
  const { id, place, exit, store, bag, load } = await setupBag([a]);
  load.mockImplementation(async () => {
    const m = loadedCharacter();
    const head = new THREE.Bone(), foot = new THREE.Bone(); head.name = "頭"; head.position.y = 17;
    foot.name = "左足首"; foot.position.y = 1; m.mesh.add(head, foot); m.mesh.bind(new THREE.Skeleton([head,foot]));
    return m;
  });
  try {
    await place(a);
    expect(store().models[0].scale).toBe(.1);
    await act(async () => { store().requestModelScale(bag().live[id(a)].runtimeId,.2); harness.frame?.({},1/90); });
    await act(async () => bag().putAway(id(a)));
    await place(a, 3);
    expect(store().models[0].scale).toBe(.2);
    expect(store().captureStage!()?.models[0].transform).toMatchObject({scale:.2, positionX:3});
  } finally { await exit(); }
});
