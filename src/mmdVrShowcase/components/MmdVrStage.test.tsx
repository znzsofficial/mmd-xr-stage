// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
import { MmdVrStageContent } from "./MmdVrStage";
import { MmdVrStageRoom } from '../stage/StageRoom';
import { createMmdRuntimeHandle, MmdRuntimeRebuildError } from "../mmdRuntime/mmdRuntime";
import { beginMmdVrAssetSession, endMmdVrAssetSession } from "../mmdVrAssets";
import { useMmdVrStore } from "../mmdVrStore";
import { getMmdVrClock } from "../mmdVrClock";
import { clearBackpack, prepareBackpackEntry, syncBackpackFiles, useBackpack } from "../backpack";
import { ThreeMmdLoader, type ThreeMmdModel } from "@yohawing/three-mmd-loader";
import { createMmdVrGltfLoader } from "../mmdVrGltf";
import * as bullet from '../mmdRuntime/bulletModule';
import {xrRoomRestoreTiming} from '../roomRestoreTiming';
import { beginBodyPreview, drainBodySide, patchBodyPreview } from '../bodyState/store';
import { makeOutletFixture } from '../bodyState/lactation/outletFixture.test-support';

const harness = vi.hoisted(() => ({
  three: {} as Record<string, unknown>,
  frame: null as null | ((state: unknown, delta: number) => void),
}));
vi.mock("@react-three/fiber", () => ({
  useThree: (select?:(state:typeof harness.three)=>unknown) => select ? select(harness.three) : harness.three,
  useFrame: (callback: typeof harness.frame) => { harness.frame = callback; },
}));
vi.mock("../mmdVrGltf", () => ({ createMmdVrGltfLoader: vi.fn() }));
vi.mock("../mmdRuntime/mmdRuntime", async importOriginal => ({
  ...await importOriginal<typeof import('../mmdRuntime/mmdRuntime')>(), createMmdRuntimeHandle: vi.fn(),
}));

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
  return { root, mesh, runtime: { dispose: vi.fn(), clearAnimation: vi.fn(), resetPose: vi.fn() }, setAnimation: vi.fn(), update: vi.fn(), diagnostics: {textures: []},
    outlineMeshes: [], renderOrderMeshes: [] } as unknown as ThreeMmdModel & { runtime: { dispose: () => void } };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function setupBag(files: File[], useMotionCache = false) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const scene = new THREE.Scene();
  harness.three = { scene, camera: new THREE.PerspectiveCamera(), size: { width: 640, height: 480 }, gl:{} };
  const real = await vi.importActual<typeof import("../mmdRuntime/mmdRuntime")>("../mmdRuntime/mmdRuntime");
  vi.mocked(createMmdRuntimeHandle).mockImplementation((scene, opts) => real.createMmdRuntimeHandle(scene, {motionCache: useMotionCache ? opts?.motionCache : undefined}));
  const load = vi.spyOn(ThreeMmdLoader.prototype, "loadModel").mockImplementation(async () => loadedCharacter());
  const motion = vi.spyOn(ThreeMmdLoader.prototype, "loadAnimation").mockImplementation(async f => ({ animation: {
    bytes: new Uint8Array(0), metadata:{ modelName:"", maxFrame:30, counts: {bones: f instanceof File ? Math.floor(f.size/111) : 0, morphs:0} }, boneTracks:{}, morphTracks:{}, cameraFrames:[], lightFrames:[], selfShadowFrames:[], propertyFrames:[],
  } } as unknown as Awaited<ReturnType<ThreeMmdLoader["loadAnimation"]>>));
  const store = useMmdVrStore.getState, bag = useBackpack.getState;
  clearBackpack(); syncBackpackFiles(files); prepareBackpackEntry(false);
  store().setPrefs({scenery:"floor"}); store().prepareStage(false); store().openOverlay();
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<StrictMode><LifecycleHarness /></StrictMode>));
  const id = (f: File) => bag().entries.find(e => e.file === f)!.id;
  const place = (f: File, x = 1, yaw = 0, z = -2) => act(async () => { bag().beginPlace(id(f)); bag().confirmPlace(id(f), x, z, yaw); });
  const exit = async () => { await act(async () => { if (store().overlayOpen) store().closeOverlay(); root.unmount(); }); };
  return { scene, root, load, motion, id, place, exit, store, bag };
}
const file = (name: string) => new File([name], name);

// loadModel accepts a File or its already-read bytes. Attribute calls to the
// actual File's backing buffers, including a second read or a second parse of
// one retained buffer. Counting reads alone would miss the latter regression.
function traceModelSource(file: File) {
  const buffers = new WeakSet<object>(), original = file.arrayBuffer.bind(file);
  const reads = vi.spyOn(file, 'arrayBuffer').mockImplementation(async () => {
    const buffer = await original(); buffers.add(buffer); return buffer;
  });
  const owns = (source: Parameters<ThreeMmdLoader['loadModel']>[0]) => source === file ||
    (typeof source === 'object' && buffers.has(ArrayBuffer.isView(source) ? source.buffer : source));
  return {reads,owns};
}

it('restores the last complete layout on a renderer replacement and releases the old committed rig exactly once',async()=>{
  const actor=file('replace.pmx'),dance=file('replace.vmd');
  const {place,root,exit,bag,id}=await setupBag([actor,dance]);
  try{
    await place(actor,2,35);await act(async()=>bag().applyMotion(id(actor),dance,'body'));
    const old=runtimeWith(actor),dispose=vi.spyOn(old,'dispose');
    harness.three={...harness.three,gl:{}};
    await act(async()=>root.render(<StrictMode><LifecycleHarness/></StrictMode>));
    expect(dispose).toHaveBeenCalledTimes(1);
    const next=runtimeWith(actor);expect(next).not.toBe(old);
    expect(next.exportProjectModels()[0]).toMatchObject({bodyMotionFile:dance,transform:{positionX:2,rotationY:35}});
    expect(bag().live[id(actor)].runtimeId).toBe(next.exportProjectModels()[0].id);
  }finally{await exit();}
});

it.each(['backpack','asset details'] as const)('keeps the actor removed via %s and restores its dancing neighbour on renderer replacement',async(entry)=>{
  const a=file('removed.pmx'),b=file('dancer.pmx'),dance=file('solo.vmd');
  const {place,id,bag,store,root,exit}=await setupBag([a,b,dance]);
  try{
    await place(a);await place(b,2,35);await act(async()=>bag().applyMotion(id(b),dance,'body'));
    const oldFrame=harness.frame!,oldRuntime=runtimeWith(b),removed=bag().live[id(a)].runtimeId;
    await act(async()=>{
      if(entry==='backpack')bag().putAway(id(a));
      else {store().enqueueModelRemoval(removed);oldFrame({},1/90);}
    });
    expect(Object.keys(bag().live)).toEqual([id(b)]);
    harness.three={...harness.three,gl:{}};
    await act(async()=>root.render(<StrictMode><LifecycleHarness/></StrictMode>));
    expect(Object.keys(bag().live)).toEqual([id(b)]);
    const next=runtimeWith(b),survivor=bag().live[id(b)].runtimeId;
    expect(next).not.toBe(oldRuntime);
    const restored=next.exportProjectModels();
    expect(restored).toMatchObject([{id:survivor,transform:{positionX:2,rotationY:35}}]);
    expect(restored[0].modelFile).toBe(b);expect(restored[0].bodyMotionFile).toBe(dance);
    await act(async()=>{store().requestModelRotation(survivor,55);oldFrame({},1/90);});
    expect(store().pendingModelTransforms).toHaveLength(1);
    await act(async()=>harness.frame!({},1/90));expect(store().models[0].rotationY).toBe(55);
  }finally{await exit();}
});

it('a retired frame cannot drain the replacement room’s pending model commands',async()=>{
  const actor=file('target.pmx'),{place,store,bag,id,exit}=await setupBag([actor]);
  try{
    await place(actor);const oldFrame=harness.frame!;
    await act(async()=>store().setPrefs({scenery:'lawn'}));await place(actor);
    const target=bag().live[id(actor)].runtimeId;
    await act(async()=>{store().requestModelScale(target,.5);oldFrame({},1/90);});
    expect(store().pendingModelTransforms).toHaveLength(1);
    await act(async()=>harness.frame!({},1/90));expect(store().models.find(m=>m.id===target)?.scale).toBe(.5);
  }finally{await exit();}
});

it('moves an actor between coincident XZ supports and restores the chosen floor',async()=>{
  const actor=file('arcade.pmx'),{id,store,bag,exit}=await setupBag([actor]);
  const room=async(scenery:'arcadeHall'|'floor')=>act(async()=>store().setPrefs({scenery}));
  const place=async(y:number)=>act(async()=>{bag().beginPlace(id(actor));bag().confirmPlace(id(actor),.65,2.83,35,y);});
  try{
    await room('arcadeHall');await place(0);const initial=bag().live[id(actor)];expect(initial.position).toEqual([.65,0,2.83]);
    await place(3.4);expect(bag().live[id(actor)]).toMatchObject({runtimeId:initial.runtimeId,position:[.65,3.4,2.83]});
    await place(2);expect(bag().error).toBeTruthy();expect(bag().live[id(actor)].position[1]).toBe(3.4);
    await room('floor');expect(bag().live[id(actor)]).toBeUndefined();await room('arcadeHall');
    expect(bag().live[id(actor)].position).toEqual([.65,3.4,2.83]);expect(store().models[0].rotationY).toBe(35);
  }finally{await exit();}
});

function runtimeWith(actor: File) {
  return vi.mocked(createMmdRuntimeHandle).mock.results.map(r => r.value as ReturnType<typeof createMmdRuntimeHandle>)
    .reverse().find(rt => rt.exportProjectModels().some(m => m.modelFile === actor))!;
}

it('accepts a drain only in its evaluated room and never transfers its visible drops across a batched return',async()=>{
  // These are explicit simulated render frames; CPU contention in a suite
  // must not stand in for the frame stall tested separately in roomMilk.
  let now=0;vi.spyOn(performance,'now').mockImplementation(()=>now);
  const actor=file('outlet.pmx'),{load,id,place,exit,bag,scene,store}=await setupBag([actor]);
  load.mockImplementation(async()=>Object.assign(loadedCharacter(),makeOutletFixture().model));
  const assetId=id(actor),tick=()=>act(async()=>{now+=1000/90;harness.frame?.({},1/90);});
  try{
    await act(async()=>useMmdVrStore.setState({presentation:'screen'}));await place(actor);
    const old=bag().live[assetId].runtimeId,oldFrame=harness.frame!;
    await act(async()=>store().setMaterialVisible(old,'outer',false));
    expect(beginBodyPreview(assetId,true)).toBe(true);patchBodyPreview(assetId,{lactating:true,left:.08});
    await tick();
    expect(drainBodySide(assetId,'left')).toEqual({before:.08,after:0,visible:true});
    const drops=scene.getObjectByName('body:milk-droplets') as THREE.InstancedMesh;expect(drops.count).toBe(1);
    await act(async()=>{store().setPrefs({scenery:'pool'});store().setPrefs({scenery:'floor'});});
    expect(bag().live[assetId].runtimeId).not.toBe(old);expect(drops.parent).toBe(null);expect(drops.count).toBe(0);
    await act(async()=>{bag().select(assetId);oldFrame({},1/90);});
    expect(beginBodyPreview(assetId,true)).toBe(true);patchBodyPreview(assetId,{lactating:true});
    expect(drainBodySide(assetId,'right')?.visible).toBe(false);await tick();expect(scene.getObjectByName('body:milk-droplets')).toBeUndefined();
    expect(drainBodySide(assetId,'right')?.visible).toBe(true);
    await act(async()=>store().closeOverlay());expect((scene.getObjectByName('body:milk-droplets') as THREE.InstancedMesh)?.count??0).toBe(0);
  }finally{await exit();}
});

for (const initial of [false, true]) {
  it.each(['pending', 'success', 'rollback', 'fatal'] as const)(`saves a complete layout on exit when physics ${initial} → ${!initial} is %s`, async outcome => {
    const actor = file('dancer.pmx'), dance = file('dance.vmd');
    const { id, place, exit, store, bag } = await setupBag([actor, dance]);
    const pending = deferred<void>();
    try {
      await place(actor, 2, 45);
      await act(async () => bag().applyMotion(id(actor), dance, 'body'));
      const runtime = runtimeWith(actor);
      const time = runtime.duration / 2;
      const rebuild = vi.spyOn(runtime, 'setPhysicsEnabled').mockResolvedValue(undefined);
      if (initial) await act(async () => store().setPhysicsEnabled(true));
      await act(async () => {
        store().setMaterialParam(bag().live[id(actor)].runtimeId, 'hair', 'opacity', .35);
        store().setLoop(false); store().setPlaying(false); store().requestSeek(time);
      });
      rebuild.mockReturnValueOnce(pending.promise);
      await act(async () => store().setPhysicsEnabled(!initial));
      expect(store()).toMatchObject({ physicsEnabled: !initial, physicsBusy: true });
      expect(rebuild).toHaveBeenLastCalledWith(!initial, expect.anything());
      const before = bag().layouts.floor!;
      expect(before).toMatchObject({ physicsEnabled: initial, time, loop: false, playing: false,
        models: [{ transform: { positionX: 2, rotationY: 45 }, materialOverrides: { hair: { opacity: .35 } } }] });
      expect(before.models[0].file).toBe(actor);
      expect(before.assets[0].kind === 'model' && before.assets[0].bodyMotionFile).toBe(dance);

      if (outcome === 'success') await act(async () => pending.resolve());
      if (outcome === 'rollback' || outcome === 'fatal') {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        if (outcome === 'fatal') runtime.removeModel(bag().live[id(actor)].runtimeId); // Failed cold recovery leaves no usable model.
        await act(async () => pending.reject(outcome === 'fatal' ? new MmdRuntimeRebuildError(Error('rebuild'), Error('restore')) : Error('rolled back')));
        expect(store().physicsError).toBeTruthy();
        expect(store().physicsFatal).toBe(outcome === 'fatal');
      }
      if (outcome !== 'pending') expect(store().physicsBusy).toBe(false);
      await act(async () => store().closeOverlay());
      const saved = store().savedStage;
      expect(saved).toEqual({ ...before, physicsEnabled: outcome === 'success' ? !initial : initial });
      if (outcome === 'pending') {
        await act(async () => pending.resolve()); // Closed room, still mounted until the host unmounts.
        expect(store().savedStage).toBe(saved); expect(bag().layouts.floor).toBe(before);
        expect(bag().live).toEqual({});
      }
      await act(async () => store().prepareStage(true));
      expect(store().resumeStage).toBe(saved); expect(store().physicsEnabled).toBe(saved!.physicsEnabled);
    } finally { await exit(); }
  });
}

it('saves the completed first switch if its queued reverse is still rebuilding at exit', async () => {
  const a = file('actor.pmx'), {place, exit, store, bag} = await setupBag([a]);
  try {
    await place(a);
    const enable = deferred<void>(), disable = deferred<void>();
    const rebuild = vi.spyOn(runtimeWith(a),'setPhysicsEnabled').mockReturnValueOnce(enable.promise).mockReturnValueOnce(disable.promise);
    await act(async () => store().setPhysicsEnabled(true));
    await act(async () => store().setPhysicsEnabled(false));
    expect(rebuild.mock.calls.map(([on]) => on)).toEqual([true]);
    await act(async () => enable.resolve());
    expect(rebuild.mock.calls.map(([on]) => on)).toEqual([true,false]);
    expect(store()).toMatchObject({physicsBusy:true,physicsEnabled:false});
    await act(async () => store().closeOverlay());
    await act(async () => disable.resolve());
    expect(store().savedStage?.physicsEnabled).toBe(true);
    expect(bag().layouts.floor?.models[0].file).toBe(a);
  } finally { await exit(); }
});

it('does not let a retired rebuild unlock a newer rebuild after a batched A→B→A', async () => {
  const a=file('actor.pmx'), {place,exit,store,bag}=await setupBag([a]);
  try {
    await place(a,2,45);
    const old = deferred<void>(), current = deferred<void>();
    vi.spyOn(runtimeWith(a),'setPhysicsEnabled').mockReturnValueOnce(old.promise);
    await act(async () => store().setPhysicsEnabled(true));
    await act(async () => { store().setPrefs({scenery:'pool'}); store().setPrefs({scenery:'floor'}); });
    expect(store()).toMatchObject({physicsEnabled:false,physicsBusy:false});
    vi.spyOn(runtimeWith(a),'setPhysicsEnabled').mockReturnValueOnce(current.promise);
    await act(async () => store().setPhysicsEnabled(true));
    const layout = bag().layouts.floor;
    await act(async () => old.reject(new MmdRuntimeRebuildError(Error('late'), Error('late restore'))));
    expect(store()).toMatchObject({physicsEnabled:true,physicsBusy:true,physicsFatal:false,physicsError:null});
    expect(bag().layouts.floor).toBe(layout);
    await act(async () => current.resolve());
    expect(store().captureStage!()).toMatchObject({physicsEnabled:true,models:[{transform:{positionX:2,rotationY:45}}]});
  } finally { await exit(); }
});

it('reuses the last large body on room return, and releases it on library removal', async () => {
  const a=file('private-actor.pmx'), vmd=new File([new Uint8Array(5*1024*1024)], 'private-dance.vmd');
  const {motion,place,exit,store,bag,id}=await setupBag([a,vmd],true);
  try {
    await place(a);await act(async()=>bag().applyMotion(id(a),vmd,'body'));
    await act(async()=>store().setPrefs({scenery:'lawn'}));
    xrRoomRestoreTiming.begin('lawn','floor',true);await act(async()=>store().setPrefs({scenery:'floor'}));
    const e=xrRoomRestoreTiming.frame('floor');expect(e?.success).toBe(true);expect(e?.taskWallMs.body).toBeTypeOf('number');
    expect(e?.motionWork).toEqual([{slot:'body',cache:'hit',evaluator:'other',loadWallMs:expect.any(Number),setAnimationMs:expect.any(Number)}]);
    expect(motion).toHaveBeenCalledOnce();expect(JSON.stringify(e)).not.toContain('private-');
    await act(async()=>store().setPrefs({scenery:'lawn'}));
    await act(async()=>syncBackpackFiles([a]));
    await act(async()=>syncBackpackFiles([a,vmd]));
    await act(async()=>store().setPrefs({scenery:'floor'}));expect(motion).toHaveBeenCalledTimes(2);
  } finally {xrRoomRestoreTiming.cancel();await exit();}
});

it('preserves the other actor and clock when unbinding, restores per-room choices, and reuses the imported motion', async () => {
  const a=file('a.pmx'), b=file('b.pmx'), body=file('body.vmd'), face=file('face.vmd');
  const {motion,place,exit,store,bag,id}=await setupBag([a,b,body,face],true);
  const bind=(actor:File, clip:File|null, slot:'body'|'face')=>act(async()=>bag().applyMotion(id(actor),clip,slot));
  const switchTo=(scenery:'floor'|'lawn')=>act(async()=>store().setPrefs({scenery}));
  try {
    await place(a);await place(b);await bind(a,body,'body');await bind(a,face,'face');await bind(b,body,'body');
    const neighbor=bag().live[id(b)],clock=store().duration/2;
    await act(async()=>{store().setPlaying(false);store().requestSeek(clock);});
    await bind(a,null,'body');expect(getMmdVrClock().time).toBe(clock);expect(store().playing).toBe(false);
    await act(async()=>store().setPlaying(true));await bind(a,null,'face');
    expect(getMmdVrClock().time).toBe(clock);expect(store().playing).toBe(true);
    expect(bag().live[id(b)].runtimeId).toBe(neighbor.runtimeId);expect(bag().bindings[id(b)].body).toBe(body);
    await switchTo('lawn');await place(a);await bind(a,face,'face');await switchTo('floor');
    expect(bag().bindings[id(a)]).toEqual({body:undefined,face:undefined});
    expect(runtimeWith(a).exportProjectModels().find(m=>m.modelFile===a)).toMatchObject({bodyMotionFile:null,faceMotionFile:null});
    await bind(b,null,'body');expect(getMmdVrClock()).toMatchObject({time:0,duration:0});expect(store().playing).toBe(false);
    expect(bag().layouts.floor).toMatchObject({time:0,playing:false});expect(bag().files).toContain(body);
    await bind(b,body,'body');expect(store().playing).toBe(true);expect(motion).toHaveBeenCalledTimes(2);
    await switchTo('lawn');expect(bag().bindings[id(a)].face).toBe(face);expect(bag().bindings[id(a)].body).toBeUndefined();
    await bind(a,null,'face');
  } finally {await exit();}
  expect(store().savedStage).toMatchObject({scenery:'lawn',time:0,playing:false,assets:[{bodyMotionFile:null,faceMotionFile:null}]});
});

it('arms idle Bullet only after the next frame of a successful fresh manual character placement', async () => {
  const cancel=vi.fn(), arm=vi.spyOn(bullet,'scheduleBulletModuleWarm').mockImplementation(()=>cancel);
  const a=file('actor.pmx'),{place,exit,load,store,bag,id}=await setupBag([a]);
  const actor=traceModelSource(a);
  const frame=()=>act(async()=>harness.frame?.({},1/90));
  try {
    await frame();load.mockRejectedValueOnce(Error('bad model'));await place(a);await frame();
    expect(arm).not.toHaveBeenCalled();expect(bag().live[id(a)]).toBeUndefined();expect(actor.reads).toHaveBeenCalledOnce();
    await place(a);expect(arm).not.toHaveBeenCalled();expect(actor.reads).toHaveBeenCalledTimes(2);
    await frame();expect(arm).toHaveBeenCalledOnce();const eligible=arm.mock.calls[0][0];expect(eligible()).toBe(true);
    await place(a,2);await frame();expect(arm).toHaveBeenCalledOnce();expect(actor.reads).toHaveBeenCalledTimes(2);
    await act(async()=>store().setPrefs({scenery:'lawn'}));expect(cancel).toHaveBeenCalled();expect(eligible()).toBe(false);
    await act(async()=>store().setPrefs({scenery:'floor'}));await frame();expect(bag().live[id(a)]).toBeDefined();expect(arm).toHaveBeenCalledOnce();
    expect(actor.reads).toHaveBeenCalledTimes(3);
    await act(async()=>bag().putAway(id(a)));await place(a);await frame();const second=arm.mock.calls[1][0];
    await act(async()=>bag().putAway(id(a)));expect(second()).toBe(false);
  } finally {await exit();}
});

it("keeps neighbors mounted, restores the actor's binding and material after put-away, and continues the actual room", async () => {
  const a = file("a.pmx"), b = file("b.pmx"), vmd = file("dance.vmd"), face = file("smile.vmd");
  const { load, motion, id, place, exit, store, bag, scene } = await setupBag([a,b,vmd,face]);
  const neighborSource = traceModelSource(b);
  try {
    expect(load).not.toHaveBeenCalled();
    await place(a); await place(b);
    const neighbor = bag().live[id(b)].runtimeId, oldId = bag().live[id(a)].runtimeId;
    const neighborRoot = runtimeWith(b).getModelRoot(neighbor)!;
    await place(a, 3, 90);
    expect(load).toHaveBeenCalledTimes(2);
    expect(bag().live[id(a)]).toMatchObject({ runtimeId:oldId, position:[3,0,-2], bounds:{center:[3,1,-2]} });
    expect(bag().live[id(a)].bounds!.size[0]).toBeCloseTo(.5);
    await act(async () => store().setMaterialParam(oldId, "hair", "opacity", .4));
    await act(async () => bag().applyMotion(id(a), vmd, "body"));
    await act(async () => bag().applyMotion(id(a), face, "face"));
    const runtime = runtimeWith(a), reseed = vi.spyOn(runtime,'resetPhysics');
    vi.spyOn(runtime,'setPhysicsEnabled').mockResolvedValue(undefined);
    await act(async () => store().setPhysicsEnabled(true));
    await place(a, 2, 135);
    expect(reseed.mock.calls).toEqual([[0, oldId]]);
    expect(bag().live[id(b)].runtimeId).toBe(neighbor);
    expect(runtime.exportProjectModels().find(m => m.id === oldId)).toMatchObject({bodyMotionFile:vmd, faceMotionFile:face,
      materialOverrides:{hair:{opacity:.4}},transform:{positionX:2,rotationY:135}});
    await act(async () => store().setPhysicsEnabled(false));
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
    expect(runtime.getModelRoot(neighbor)).toBe(neighborRoot);
    expect(neighborSource.reads).toHaveBeenCalledOnce();
    expect(load.mock.calls.filter(([source]) => neighborSource.owns(source))).toHaveLength(1);

    await act(async () => store().setPrefs({scenery:"lawn"}));
    expect(scene.children).toHaveLength(0);
    expect(bag().live).toEqual({});
    await place(a, -3);
    await act(async () => bag().applyMotion(id(a), face, "body"));
    expect(bag().bindings[id(a)].body).toBe(face);
    await act(async () => store().setPrefs({scenery:"floor"}));
    expect(scene.children).toHaveLength(2);
    expect(runtimeWith(b).getModelRoot(bag().live[id(b)].runtimeId)).not.toBe(neighborRoot);
    expect(neighborSource.reads).toHaveBeenCalledTimes(2);
    expect(load.mock.calls.filter(([source]) => neighborSource.owns(source))).toHaveLength(2);
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
    await place(prop);
    const runtimeId = bag().live[id(prop)].runtimeId;
    await place(prop, -1.5, 90);
    expect(loadAsync).toHaveBeenCalledTimes(2);
    expect(bag().live[id(prop)].runtimeId).toBe(runtimeId);
    expect(store().objects[0].rotationY).toBeCloseTo(90);
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

it("rejects water and fixtures on a move, and uses the actual floor rather than a square near the origin", async () => {
  const a = file("a.pmx"), { id, place, exit, store, bag, load } = await setupBag([a]);
  try {
    await act(async () => store().setPrefs({scenery:"pool"}));
    await place(a);
    const before = bag().live[id(a)];
    for (const [x,z] of [[-4.34,-5.47],[0,-12]]) {
      await place(a, x, 10, z);
      expect(bag().error).toBeTruthy(); expect(bag().live[id(a)]).toEqual(before);
    }
    expect(load).toHaveBeenCalledOnce();
    await place(a, 1, 90, -3);
    expect(bag().live[id(a)].position).toEqual([1,0,-3]);
    await act(async () => store().setPrefs({scenery:'floor'}));
    await place(a); await place(a, 7, 90, 0);
    expect(bag().live[id(a)].position).toEqual([7,0,0]);
  } finally { await exit(); }
});

it('persists a gallery performance at its actual height and moves the restored instance down to the low stage',async()=>{
  const a=file('singer.pmx'),{id,place,exit,store,bag}=await setupBag([a]);
  try{
    await act(async()=>store().setPrefs({scenery:'qinhuai'}));
    await place(a,-6.76,90,-1.8);
    expect(bag().live[id(a)].position).toEqual([-6.76,2.72,-1.8]);
    await act(async()=>store().setPrefs({scenery:'lawn'}));await act(async()=>store().setPrefs({scenery:'qinhuai'}));
    expect(bag().live[id(a)].position).toEqual([-6.76,2.72,-1.8]);
    const restoredId = bag().live[id(a)].runtimeId;
    await place(a,0,90,-5);
    expect(bag().live[id(a)]).toMatchObject({runtimeId:restoredId,position:[0,.42,-5]});
    expect(store().models[0].rotationY).toBe(90);
  }finally{await exit();}
});

it('never re-spawns a removed actor from a draft or an already confirmed move', async () => {
  const a=file('actor.pmx'), {id,place,exit,store,bag,load}=await setupBag([a]);
  try {
    for (const confirmed of [false,true]) {
      await place(a);
      await act(async () => {
        bag().beginPlace(id(a));
        if (confirmed) bag().confirmPlace(id(a),3,-1,45);
        store().enqueueModelRemoval(bag().live[id(a)].runtimeId); harness.frame?.({},1/90);
        if (!confirmed) bag().confirmPlace(id(a),3,-1,45);
      });
      expect(bag().draft).toBeNull(); expect(bag().command).toBeNull(); expect(bag().live[id(a)]).toBeUndefined();
    }
    expect(load).toHaveBeenCalledTimes(2);
  } finally { await exit(); }
});

it("repairs a dynamic actor with texture warnings without replacing either the last clean layout or its neighbor on failure", async () => {
  const a = file("a.pmx"), b = file("b.pmx"), dance = file("dance.vmd");
  const { id, place, exit, store, bag, load, scene } = await setupBag([a,b,dance]);
  const neighborSource = traceModelSource(b);
  try {
    await place(b);
    const damaged = loadedCharacter();
    Object.assign(damaged.diagnostics, { textures: [{ code:"TEXTURE_RESOLVE_FAILED", path:"hair.png" }] });
    load.mockResolvedValueOnce(damaged);
    await place(a);
    const idA = bag().live[id(a)].runtimeId, idB = bag().live[id(b)].runtimeId;
    const neighborRoot = runtimeWith(b).getModelRoot(idB)!;
    expect(store().assetLoad.failures[0].message).toContain("hair.png");
    expect(bag().layouts.floor?.models.map(m => m.file)).toEqual([b]);
    await act(async () => { store().setMaterialParam(idA, "hair", "roughness", .3); bag().applyMotion(id(a), dance, "body"); });
    load.mockRejectedValueOnce(new Error("bad repair"));
    await act(async () => store().retryFailedAssets());
    expect(store().assetLoad.failures[0].message).toBe("bad repair");
    expect(bag().live[id(a)].runtimeId).toBe(idA);
    expect(runtimeWith(b).getModelRoot(idB)).toBe(neighborRoot);
    expect(scene.children).toHaveLength(2);
    await act(async () => store().retryFailedAssets());
    expect(store().assetLoad.failures).toEqual([]);
    expect(bag().live[id(a)].runtimeId).not.toBe(idA);
    expect(bag().bindings[id(a)].body).toBe(dance);
    expect(store().materialModels[bag().live[id(a)].runtimeId][0].roughness).toBe(.3);
    expect(bag().live[id(b)].runtimeId).toBe(idB);
    expect(bag().layouts.floor?.models).toHaveLength(2);
    expect(runtimeWith(b).getModelRoot(idB)).toBe(neighborRoot);
    expect(neighborSource.reads).toHaveBeenCalledOnce();
    expect(load.mock.calls.filter(([source]) => neighborSource.owns(source))).toHaveLength(1);
  } finally { await exit(); }
});

it('commits detail removals only after the last outstanding actor repair is gone',async()=>{
  const a=file('first.pmx'),b=file('second.pmx'),c=file('damaged.pmx');
  const {place,id,bag,store,exit,load}=await setupBag([a,b,c]);
  const remove=(f:File)=>act(async()=>{store().enqueueModelRemoval(bag().live[id(f)].runtimeId);harness.frame!({},1/90);});
  try{
    await place(a);await place(b);
    const damaged=loadedCharacter();Object.assign(damaged.diagnostics,{textures:[{code:'TEXTURE_RESOLVE_FAILED',path:'missing.png'}]});
    load.mockResolvedValueOnce(damaged);await place(c);
    const lastGood=bag().layouts.floor!;expect(lastGood.models).toHaveLength(2);
    await remove(a);expect(store().assetLoad.failures).toHaveLength(1);expect(bag().layouts.floor).toBe(lastGood);
    await remove(c);expect(store().assetLoad.failures).toEqual([]);
    const committed=bag().layouts.floor!;expect(committed.models).toHaveLength(1);expect(committed.models[0].file).toBe(b);
  }finally{await exit();}
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
