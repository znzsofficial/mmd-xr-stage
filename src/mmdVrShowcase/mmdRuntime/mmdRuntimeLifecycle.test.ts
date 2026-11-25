import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { ThreeMmdLoader, type ThreeMmdModel } from "@yohawing/three-mmd-loader";
import { createBulletPhysicsBackend } from "./mmdPhysics";
import { createLocalTextureResolver, createMmdRuntimeHandle } from "./mmdRuntime";
import { expandAssetFiles } from "../../mmdImport/importArchive";
import { BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { bindCompanion } from "../../mmdImport/assetPaths";
import { createModelLoadTask } from "../stage/loading/modelLoadTask";
import { createAssetLoadQueue } from "../stage/loading/mmdAssetLoadQueue";
import { createRoomMotionCache } from './roomMotionCache';
import { createMountedModelBytePool } from './mountedModelBytes';
import { poseFixture } from '../pose/poseFixture.testSupport';
import { DEFAULT_BODY_PROFILE } from '../bodyState/data';

vi.mock("./mmdPhysics", async (original) => ({
  ...await original<typeof import("./mmdPhysics")>(),
  createBulletPhysicsBackend: vi.fn(),
}));

function modelFixture() {
  const mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  mesh.bind(new THREE.Skeleton([]));
  const root = new THREE.Group();
  root.add(mesh);
  const model = {
    root, mesh, runtime: { dispose: vi.fn() }, setAnimation: vi.fn(),
    diagnostics: { textures: [] }, outlineMeshes: [], renderOrderMeshes: [],
  } as unknown as ThreeMmdModel;
  return model;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return {promise,resolve};
}

afterEach(() => vi.restoreAllMocks());

describe("runtime asynchronous lifecycle", () => {
  it("constructs the real loader for multiple ZIPs and resolves only the selected model's textures", async () => {
    async function pack(name: string, textureName: string) {
      const zip = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
      await zip.add("model.pmx", new TextReader("mock model bytes"));
      await zip.add(textureName, new TextReader(name));
      return new File([await zip.close()], name);
    }
    const files = await expandAssetFiles([await pack("a.zip", "face.png"), await pack("b.zip", "body.png")]);
    const a = files.find((file) => file.webkitRelativePath === "a.zip/model.pmx")!;
    const b = files.find((file) => file.webkitRelativePath === "b.zip/model.pmx")!;
    const resolver = createLocalTextureResolver(a, files);
    // The constructor is real: its option validation must not encounter undefined map entries.
    expect(() => new ThreeMmdLoader({ textureResolver: resolver })).not.toThrow();
    expect(await resolver.resolve("face.png")).toBe(files.find((f) => f.webkitRelativePath === "a.zip/face.png"));
    expect(await resolver.resolve("body.png")).toBeUndefined();
    vi.spyOn(ThreeMmdLoader.prototype, "loadModel").mockImplementation(async () => modelFixture());
    const runtime = createMmdRuntimeHandle(new THREE.Scene());
    try {
      await runtime.addModel(a, files);
      await runtime.addModel(b, files);
      expect(runtime.listModels()).toHaveLength(2);
      const chosen = new File(["texture"], "replacement.png");
      files.push(chosen);
      bindCompanion(a, "missing.png", chosen);
      expect(await resolver.resolve("missing.png")).toBe(chosen);
    } finally { runtime.dispose(); }
  });

  it("reports texture diagnostics and reloads the affected model and motions without duplicating other models", async () => {
    const file = new File(["model"], "model.pmx"), motion = new File(["motion"], "dance.vmd");
    const damaged = modelFixture(), repaired = modelFixture();
    Object.assign(damaged.diagnostics, { textures: [{ code: "TEXTURE_RESOLVE_FAILED", path: "broken.png" }] });
    const disposeDamaged = vi.spyOn(damaged.mesh.geometry, "dispose");
    vi.spyOn(ThreeMmdLoader.prototype, "loadModel").mockResolvedValueOnce(damaged).mockResolvedValueOnce(repaired);
    const runtime = createMmdRuntimeHandle(new THREE.Scene());
    const loadMotion = vi.spyOn(runtime, "loadMotion").mockResolvedValue();
    const task = createModelLoadTask(runtime, { kind: "model", modelFile: file, companionFiles: [file], bodyMotionFile: motion },
      { transform: { scale: 0.2 }, isStale: () => false, physicsEnabled: () => false });
    const otherModel = vi.fn(async () => {});
    const publish = vi.fn();
    const queue = createAssetLoadQueue([
      { id: "model", fileName: file.name, phase: "model", run: task.load },
      { id: "motion", fileName: motion.name, phase: "body", requires: "model", run: () => task.loadMotion(motion, "body") },
      { id: "other", fileName: "other.pmx", phase: "model", run: otherModel },
    ]);
    try {
      await queue.run(publish);
      expect(publish.mock.lastCall?.[0].failures[0].message).toContain("TEXTURE_RESOLVE_FAILED: broken.png");
      const oldId = runtime.listModels()[0].id;
      runtime.setModelTransform(oldId, { positionX: 2 });
      await queue.run(publish);
      const [model] = runtime.listModels();
      expect(runtime.listModels()).toHaveLength(1);
      expect(model.id).not.toBe(oldId);
      expect(model.transform).toMatchObject({ positionX: 2, scale: 0.2 });
      expect(disposeDamaged).toHaveBeenCalledOnce();
      expect(loadMotion.mock.calls.map((call) => call[2])).toEqual([oldId, model.id]);
      expect(otherModel).toHaveBeenCalledOnce();
      expect(publish.mock.lastCall?.[0].failures).toEqual([]);
    } finally { runtime.dispose(); }
  });
  it.each(['dispose','clearAll'] as const)("disposes a model arriving after %s", async (end) => {
    const scene = new THREE.Scene();
    const model = modelFixture();
    const dispose = vi.spyOn(model.mesh.geometry, "dispose");
    let resolve!: (model: ThreeMmdModel) => void;
    const entered = deferred<void>();
    vi.spyOn(ThreeMmdLoader.prototype, "loadModel").mockImplementationOnce(() => {
      entered.resolve(); return new Promise(done => { resolve = done; });
    });
    const runtime = createMmdRuntimeHandle(scene);
    const pending = runtime.addModel(new File(["pmx"], "model.pmx"));
    await entered.promise;
    runtime[end]();
    resolve(model);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(scene.children).toHaveLength(0);
    expect(dispose).toHaveBeenCalledOnce();
    expect((model.runtime as unknown as { dispose: () => void }).dispose).toHaveBeenCalledOnce();
    runtime.dispose();
  });

  it.each([true, false])('reads a real PMX once on placement and only rereads on disable outside the budget (admitted: %s)', async admitted => {
    const fixture = poseFixture(false, 'body'), pmx = new File([fixture.pmx], 'actor.pmx'), vmd = new File([fixture.vmd], 'motion.vmd');
    const read = vi.spyOn(pmx, 'arrayBuffer'), pool = createMountedModelBytePool(admitted ? pmx.size : pmx.size - 1);
    const runtime = createMmdRuntimeHandle(new THREE.Scene(), {modelBytePool:pool});
    const world = {name:'test', disabled:false, disposed:false, step:()=>({simulated:false}), dispose:vi.fn()};
    vi.mocked(createBulletPhysicsBackend).mockResolvedValueOnce(world);
    const camera = new THREE.PerspectiveCamera();
    try {
      const {modelId:id} = await runtime.addModel(pmx);
      expect(read).toHaveBeenCalledTimes(1); expect(pool.reservedBytes).toBe(admitted ? pmx.size : 0);
      await runtime.loadMotion(vmd, 'body', id);
      const mesh = runtime.getModelSurface(id)!.mesh;
      runtime.update(1.5,false,camera,1,false); const posed = mesh.getVertexPosition(0,new THREE.Vector3());
      await runtime.setPhysicsEnabled(true); expect(read).toHaveBeenCalledTimes(1);
      const work = {}; await runtime.setPhysicsEnabled(false,work);
      expect(work).toMatchObject(admitted ? {modelByteHits:1} : {modelByteReads:1});
      expect(read).toHaveBeenCalledTimes(admitted ? 1 : 2);
      expect(world.dispose).toHaveBeenCalledOnce(); expect(runtime.getModelSurface(id)!.mesh).toBe(mesh);
      runtime.update(1.5,false,camera,1,false); expect(mesh.getVertexPosition(0,new THREE.Vector3()).distanceTo(posed)).toBeLessThan(1e-5);
      expect(runtime.exportProjectModels()[0].bodyMotionFile).toBe(vmd);
      runtime.removeModel(id); expect(pool.reservedBytes).toBe(0);
    } finally { runtime.dispose(); }
  });

  it('a failed off-evaluator keeps the playing VMD, original world and source bytes for an in-place retry', async()=>{
    const f=poseFixture(),file=new File([f.pmx],'actor.pmx'),motion=new File([f.vmd],'body.vmd');
    const read=vi.spyOn(file,'arrayBuffer'),pool=createMountedModelBytePool(file.size);
    const world={name:'test',disabled:false,disposed:false,step:vi.fn(()=>({simulated:false})),dispose:vi.fn()};
    vi.mocked(createBulletPhysicsBackend).mockResolvedValueOnce(world);
    const rt=createMmdRuntimeHandle(new THREE.Scene(),{modelBytePool:pool});const camera=new THREE.PerspectiveCamera();
    try{
      const {modelId:id}=await rt.addModel(file,[],{physics:true});await rt.loadMotion(motion,'body',id);
      const root=rt.getModelRoot(id),live=rt.getModelSurface(id)!.mesh;
      const create=vi.spyOn(ThreeMmdLoader.prototype,'createDetachedRuntime').mockRejectedValueOnce(Error('unavailable'));
      await expect(rt.setPhysicsEnabled(false)).rejects.toThrow('unavailable');
      expect(rt.getModelSurface(id)!.mesh).toBe(live);expect(rt.exportProjectModels()[0].bodyMotionFile).toBe(motion);
      rt.update(1,true,camera,1,false,1/72);expect(world.step).toHaveBeenCalled();expect(world.dispose).not.toHaveBeenCalled();
      await rt.setPhysicsEnabled(false);expect(world.dispose).toHaveBeenCalledOnce();expect(rt.getModelRoot(id)).toBe(root);
      expect(create.mock.calls[1][0].modelBytes).toBe(create.mock.calls[0][0].modelBytes);expect(read).toHaveBeenCalledOnce();
    }finally{rt.dispose();}expect(pool.reservedBytes).toBe(0);
  });

  it('clear retires an unresolved first read immediately; late bytes cannot mount or fill a replacement slot',async()=>{
    const fixture = poseFixture(false,'body'), file = new File([fixture.pmx],'actor.pmx');
    const {promise, resolve} = deferred<ArrayBuffer>();
    const read = vi.spyOn(file,'arrayBuffer').mockReturnValueOnce(promise);
    const pool=createMountedModelBytePool(file.size), runtime=createMmdRuntimeHandle(new THREE.Scene(),{modelBytePool:pool});
    try {
      const old=runtime.addModel(file); expect(pool.reservedBytes).toBe(file.size);
      runtime.clearAll(); expect(pool.reservedBytes).toBe(0);
      const fresh=await runtime.addModel(file); resolve(fixture.pmx.buffer);
      await expect(old).rejects.toMatchObject({name:'AbortError'});
      expect(read).toHaveBeenCalledTimes(2); expect(runtime.listModels().map(m=>m.id)).toEqual([fresh.modelId]);
      expect(pool.reservedBytes).toBe(file.size);
    } finally {runtime.dispose();} expect(pool.reservedBytes).toBe(0);
  });

  it('shares only a real File among concurrent actors; a rejected parse releases only its own reservation',async()=>{
    const fixture=poseFixture(), one = new File([fixture.pmx],'same.pmx'), other = new File([fixture.pmx],'same.pmx');
    const pool=createMountedModelBytePool(one.size), a=createMmdRuntimeHandle(new THREE.Scene(),{modelBytePool:pool}),
      b=createMmdRuntimeHandle(new THREE.Scene(),{modelBytePool:pool});
    const {promise,resolve}=deferred<ArrayBuffer>(), firstRead=vi.spyOn(one,'arrayBuffer').mockReturnValueOnce(promise);
    const otherRead=vi.spyOn(other,'arrayBuffer');
    try{
      const p=a.addModel(one),q=b.addModel(one);
      expect(pool.reservedBytes).toBe(one.size);expect(firstRead).toHaveBeenCalledOnce();
      const {modelId:uncached}=await b.addModel(other); expect(otherRead).toHaveBeenCalledOnce();
      resolve(fixture.pmx.buffer); const [actor]=await Promise.all([p,q]);expect(firstRead).toHaveBeenCalledOnce();
      a.removeModel(actor.modelId);expect(pool.reservedBytes).toBe(one.size);
      b.removeModel(uncached);expect(pool.reservedBytes).toBe(one.size);
      b.clearAll();expect(pool.reservedBytes).toBe(0);
      vi.spyOn(ThreeMmdLoader.prototype,'loadModel').mockRejectedValueOnce(Error('bad parse'));
      await expect(a.addModel(one)).rejects.toThrow('bad parse');expect(pool.reservedBytes).toBe(0);
      firstRead.mockRejectedValueOnce(Error('disk unavailable'));
      await expect(a.addModel(one)).rejects.toThrow('disk unavailable');expect(pool.reservedBytes).toBe(0);
      await a.addModel(one); expect(firstRead).toHaveBeenCalledTimes(4);expect(pool.reservedBytes).toBe(one.size);
    }finally{a.dispose();b.dispose();} expect(pool.reservedBytes).toBe(0);
  });

  it("converts controller coordinates and radius independently of visual model scale", async () => {
    const model = modelFixture();
    vi.spyOn(ThreeMmdLoader.prototype, "loadModel").mockResolvedValue(model);
    const dispose = vi.fn();
    const enabled = vi.fn(() => true);
    vi.mocked(createBulletPhysicsBackend).mockResolvedValue({ name: "bullet", disabled: false, disposed: false, step: () => ({ simulated: true }), dispose });
    const runtime = createMmdRuntimeHandle(new THREE.Scene(), {
      controllerColliders: () => [new THREE.Matrix4().makeTranslation(1, 2, 3), new THREE.Matrix4()],
      controllerCollidersEnabled: enabled,
      controllerColliderRadius: () => 0.08,
    });
    try {
      const { modelId } = await runtime.addModel(new File(["pmx"], "model.pmx"), [], { physics: true, transform: { scale: 0.2 } });
      const options = vi.mocked(createBulletPhysicsBackend).mock.lastCall![0]!;
      const matrix = options.controllerColliders!()[0];
      expect(enabled).toHaveBeenCalledTimes(1);
      expect([...matrix.slice(12, 15)]).toEqual([5, 10, -15]);
      expect((options.controllerRadius as () => number)()).toBeCloseTo(0.4);
      runtime.setModelTransform(modelId, { scale: 0.4 });
      expect((options.controllerRadius as () => number)()).toBeCloseTo(0.2);
      enabled.mockReturnValue(false);
      const hidden = options.controllerColliders!();
      expect(hidden.every((matrix) => matrix[13] === -1000)).toBe(true);
    } finally { runtime.dispose(); }
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("does not report stale haptic contacts from hidden or disposed models", async () => {
    vi.spyOn(ThreeMmdLoader.prototype, "loadModel").mockResolvedValue(modelFixture());
    const query = vi.fn(() => 2);
    const backend = { name: "bullet", disabled: false, disposed: false, step: () => ({ simulated: true }), debugControllerContactCount: query };
    vi.mocked(createBulletPhysicsBackend).mockResolvedValue(backend);
    const runtime = createMmdRuntimeHandle(new THREE.Scene());
    try {
      const { modelId } = await runtime.addModel(new File(["pmx"], "model.pmx"), [], { physics: true });
      expect(runtime.getControllerContactCount(0)).toBe(2);
      runtime.setModelVisible(modelId, false);
      expect(runtime.getControllerContactCount(0)).toBe(0);
      expect(query).toHaveBeenCalledTimes(1);
      runtime.setModelVisible(modelId, true);
      backend.disposed = true;
      expect(runtime.getControllerContactCount(0)).toBe(0);
      expect(query).toHaveBeenCalledTimes(1);
    } finally { runtime.dispose(); }
  });

  it("does not apply a late motion to a disposed model", async () => {
    const model = modelFixture();
    vi.spyOn(ThreeMmdLoader.prototype, "loadModel").mockResolvedValue(model);
    let finish!: (animation: Awaited<ReturnType<ThreeMmdLoader["loadAnimation"]>>) => void;
    vi.spyOn(ThreeMmdLoader.prototype, "loadAnimation").mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
    const runtime = createMmdRuntimeHandle(new THREE.Scene());
    const { modelId } = await runtime.addModel(new File(["pmx"], "model.pmx"));
    const pending = runtime.loadMotion(new File(["vmd"], "dance.vmd"), "body", modelId);
    runtime.dispose();
    finish({} as Awaited<ReturnType<ThreeMmdLoader["loadAnimation"]>>);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(model.setAnimation).not.toHaveBeenCalled();
  });

  it.each([false, true])('unbinds VMD layers on a skinned PMX and restores its cold pose through editing and rebinding (physics world: %s)', async physics => {
    const f = poseFixture(false, 'body'), pmx = new File([f.pmx], 'actor.pmx');
    const body = new File([f.vmd], 'arm.vmd'), face = new File([poseFixture(false, 'face').vmd], 'expression.vmd');
    const step = vi.fn(() => ({simulated: false}));
    if (physics) vi.mocked(createBulletPhysicsBackend).mockResolvedValueOnce({name:'test', disabled:false, disposed:false, step});
    const runtime = createMmdRuntimeHandle(new THREE.Scene(), {motionCache:createRoomMotionCache()});
    const camera = new THREE.PerspectiveCamera(), at = (t: number) => runtime.update(t, false, camera, 1, false);
    try {
      const {modelId:id} = await runtime.addModel(pmx, [], {physics});
      const mesh = runtime.getModelSurface(id)!.mesh, foot = mesh.skeleton.getBoneByName('LeftFoot')!;
      const toe = () => foot.getWorldPosition(new THREE.Vector3()), wristVertex = () => mesh.getVertexPosition(0, new THREE.Vector3());
      const weight = () => mesh.morphTargetInfluences![mesh.morphTargetDictionary!.Gesture];
      at(0); const neutral = wristVertex(), planted = toe();
      await runtime.loadMotion(body, 'body', id); at(1.5); const armOnly = wristVertex();
      expect(armOnly.distanceTo(neutral)).toBeGreaterThan(.05);
      await runtime.loadMotion(face, 'face', id); at(1.5);
      const expressive = weight(); expect(expressive).toBeGreaterThan(.5);
      runtime.clearMotion(id, 'face'); at(1.5);
      expect(weight()).toBe(0); expect(wristVertex().distanceTo(armOnly)).toBeLessThan(1e-5);
      await runtime.loadMotion(face, 'face', id); at(1.5);
      runtime.clearMotion(id, 'body'); at(1.5);
      expect(weight()).toBeCloseTo(expressive); expect(toe().distanceTo(planted)).toBeLessThan(1e-5);
      expect(runtime.exportProjectModels()[0]).toMatchObject({bodyMotionFile:null,faceMotionFile:face});
      const withFace = wristVertex(); expect(withFace.distanceTo(armOnly)).toBeGreaterThan(.05);

      const posing = runtime.beginPose(id, 1.5)!;
      expect(posing.rotate('rightHand', 'z', .8)).toBe(true); at(1.5);
      expect(wristVertex().distanceTo(withFace)).toBeGreaterThan(.005);
      runtime.clearMotion(id, 'face'); at(0); at(1.5);
      expect(posing.rotate('rightHand', 'z', .8)).toBe(false); expect(weight()).toBe(0);
      expect(runtime.duration).toBe(0); expect(runtime.listModels()[0]).toMatchObject({bodyMotionName:null,faceMotionName:null});
      expect(wristVertex().distanceTo(neutral)).toBeLessThan(1e-5); expect(toe().distanceTo(planted)).toBeLessThan(1e-5);
      expect(runtime.beginPose(id, 0)!.rotate('rightHand','x',.6)).toBe(true); at(0); runtime.endPose(id); at(0);
      expect(wristVertex().distanceTo(neutral)).toBeLessThan(1e-5); expect(toe().distanceTo(planted)).toBeLessThan(1e-5);
      if (physics) { runtime.update(0, true, camera, 1, false, 1/90); expect(step).toHaveBeenCalled(); }
      await runtime.loadMotion(body, 'body', id); at(1.5);
      expect(wristVertex().distanceTo(armOnly)).toBeLessThan(1e-5); expect(runtime.duration).toBe(2);
    } finally { runtime.dispose(); }
  });

  it('evaluates manual group weights on a cold PMX, then releases to bind or the paused VMD', async () => {
    const {pmx,vmd}=poseFixture(false,'face'),rt=createMmdRuntimeHandle(new THREE.Scene()),camera=new THREE.PerspectiveCamera();
    try {
      const {modelId:id}=await rt.addModel(new File([pmx],'actor.pmx'));
      const mesh=rt.getModelSurface(id)!.mesh,step=()=>rt.update(1,false,camera,1,false,0);
      const vertex=()=>mesh.getVertexPosition(0,new THREE.Vector3()),foot=mesh.skeleton.getBoneByName('LeftFoot')!;
      step();const cold=vertex(),planted=foot.matrixWorld.clone();
      rt.setMorphWeight(id,'Gesture',.5);step();const half=vertex();
      expect(half.distanceTo(cold)).toBeGreaterThan(.001);expect(mesh.morphTargetInfluences![0]).toBeCloseTo(.35);
      step();expect(vertex().distanceTo(half)).toBeLessThan(1e-6);
      rt.setMorphWeight(id,'Gesture',0);step();expect(vertex().distanceTo(cold)).toBeLessThan(1e-6);expect(foot.matrixWorld).toEqual(planted);
      await rt.loadMotion(new File([vmd],'face.vmd'),'face',id);step();const clip=vertex();
      rt.setMorphWeight(id,'Expression',1);step();expect(mesh.morphTargetInfluences![0]).toBeCloseTo(.7);
      expect(vertex().distanceTo(clip)).toBeGreaterThan(.001);
      rt.setMorphWeight(id,'Expression',0);step();expect(vertex().distanceTo(clip)).toBeLessThan(1e-6);
    } finally {rt.dispose();}
  });

  it('restores draw opacity and visual scale on a failed paused frame; only completed frames apply the body shape', async () => {
    const model = modelFixture(), {mesh, root} = model;
    const cloth = [mesh.material].flat()[0]; cloth.name = 'coat'; cloth.opacity = .75;
    mesh.geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([0, .1, 0], 3)];
    mesh.morphTargetDictionary = {Fit: 0};
    const weights = mesh.morphTargetInfluences = [0];
    const inputs: number[][] = [];
    let raw = .25, fail = false;
    Object.assign(model.runtime, {seek: vi.fn()});
    Object.assign(model, {update() {
      inputs.push([root.scale.x, cloth.opacity, weights[0]]);
      weights[0] = raw;
      if (fail) throw Error('pose evaluation failed');
    }});
    vi.spyOn(ThreeMmdLoader.prototype, 'loadModel').mockResolvedValue(model);
    vi.mocked(createBulletPhysicsBackend).mockResolvedValueOnce({name:'test', disabled:false, disposed:false, step:()=>({simulated:false})});
    const runtime = createMmdRuntimeHandle(new THREE.Scene()), camera = new THREE.PerspectiveCamera();
    const paused = () => runtime.update(0, true, camera, 1, false, 1/72);
    try {
      const {modelId:id} = await runtime.addModel(new File([], 'actor.pmx'), [], {physics:true, transform:{scale:.2}});
      runtime.setMaterialOverride(id, 'coat', {opacity:.5});
      runtime.setBodyProfile!(id, {...DEFAULT_BODY_PROFILE, morph:'Fit', fullness:.5});
      paused(); expect(weights[0]).toBe(.625);

      raw = .5; fail = true;
      expect(paused).toThrow('pose evaluation failed');
      expect([root.scale.x, cloth.opacity, weights[0]]).toEqual([.2, .375, .5]);

      raw = .375;
      runtime.resetPhysics(0, id); // an explicit reset recovers from the same failure
      expect([root.scale.x, cloth.opacity, weights[0]]).toEqual([.2, .375, .375]);

      raw = .125; fail = false;
      runtime.resetPhysics(0, id); // seed only: no ordinary body presentation
      expect([root.scale.x, cloth.opacity, weights[0]]).toEqual([.2, .375, .125]);
      paused(); expect(weights[0]).toBe(.5625);
      expect(inputs).toEqual([[1,.75,0], [1,.75,.25], [1,.75,.5], [1,.75,.375], [1,.75,.125]]);
    } finally { runtime.dispose(); }
  });

  it("rolls back a failed motion bind from the original rest pose, not the simulated or displayed hem", async () => {
    const model = modelFixture(), hem = new THREE.Bone();
    hem.position.y = 1; model.mesh.add(hem); model.mesh.bind(new THREE.Skeleton([hem]));
    vi.spyOn(ThreeMmdLoader.prototype, "loadModel").mockResolvedValue(model);
    const factory = vi.mocked(createBulletPhysicsBackend);
    factory.mockResolvedValueOnce({name: "solver", disabled: false, disposed: false, step: () => ({simulated: true})});
    const cache = createRoomMotionCache();
    const rt = createMmdRuntimeHandle(new THREE.Scene(), {motionCache:cache});
    try {
      const {modelId} = await rt.addModel(new File([], "actor.pmx"), [], {physics: true});
      const [animation] = vi.mocked(model.setAnimation).mock.calls[0]; // initial static binding
      if (!("kind" in animation)) throw Error("Expected a raw VMD");
      const original = new File([new Uint8Array(5*1024*1024)], "first.vmd"), replacement = new File([original], "second.vmd");
      const tracks = {...animation, metadata:{...animation.metadata,counts:{...animation.metadata.counts,bones:Math.floor(original.size/111)}}};
      const first = {source: original, animation:tracks}, second = {source: replacement, animation:tracks};
      vi.spyOn(ThreeMmdLoader.prototype, "loadAnimation").mockResolvedValueOnce(first).mockResolvedValueOnce(second);
      await rt.loadMotion(original, "body", modelId);

      const record = factory.mock.lastCall![0]!.onPhysicsBones!;
      const bodies = [{index: 0, boneIndex: 0, motionType: "dynamic", shape: {type: "sphere", size: [1,0,0]}}] as const;
      let rawY = 1;
      Object.assign(model.runtime, {seek: vi.fn()});
      Object.assign(model, {update() { hem.position.y = rawY; model.root.updateMatrixWorld(true); record([0], 1, bodies); }});
      const camera = new THREE.PerspectiveCamera();
      const pausedFrame = () => rt.update(0, true, camera, 1, false, 1/60);
      pausedFrame(); rawY = .99; pausedFrame();
      expect(hem.position.y).toBeGreaterThan(rawY);

      const bind = vi.mocked(model.setAnimation).mockClear().mockImplementation(clip => {
        expect(hem.position.y).toBe(1);
        if (clip === second) throw Error("rejected motion");
      });
      await expect(rt.loadMotion(replacement, "body", modelId)).rejects.toThrow("rejected motion");
      expect(bind.mock.calls.map(([clip]) => clip)).toEqual([second, first]);
      expect(rt.exportProjectModels()[0].bodyMotionFile).toBe(original);
      expect(cache.acquire(original,'body').status).toBe('hit');
      rawY = .98; pausedFrame(); expect(hem.position.y).toBe(rawY); // no pre-bind filter history
    } finally { rt.dispose(); }
  });

  it.each(['dispose','clearAll'] as const)('releases an arriving world after %s without resurrecting its actor', async end => {
    const model = modelFixture(), load = vi.spyOn(ThreeMmdLoader.prototype,'loadModel').mockResolvedValue(model);
    const release = vi.spyOn(model.mesh.geometry,'dispose'), factory = vi.mocked(createBulletPhysicsBackend);
    const world = {name:'bullet',disabled:false,disposed:false,step:()=>({simulated:true}),dispose:vi.fn()};
    let ready!: (value:Awaited<ReturnType<typeof createBulletPhysicsBackend>>) => void;
    factory.mockReturnValueOnce(new Promise(resolve => { ready = resolve; }));
    const rt=createMmdRuntimeHandle(new THREE.Scene());await rt.addModel(new File(['x'],'m.pmx'));
    const pending=rt.setPhysicsEnabled(true);await Promise.resolve();rt[end]();ready(world);
    await expect(pending).rejects.toMatchObject({name:'AbortError'});
    expect(world.dispose).toHaveBeenCalledOnce();expect(release).toHaveBeenCalledOnce();expect(load).toHaveBeenCalledOnce();expect(rt.listModels()).toHaveLength(0);
    rt.dispose();
  });

  it('preserves both live actors and frees a prepared world when the second world cannot be created', async()=>{
    const load=vi.spyOn(ThreeMmdLoader.prototype,'loadModel').mockImplementation(async()=>modelFixture());
    const rt=createMmdRuntimeHandle(new THREE.Scene());const file=new File(['x'],'m.pmx');
    const a=await rt.addModel(file),b=await rt.addModel(file);rt.selectModel(a.modelId);rt.setModelVisible(b.modelId,false);
    const before=rt.listModels(),roots=before.map(m=>rt.getModelRoot(m.id));
    const dispose=vi.fn();vi.mocked(createBulletPhysicsBackend).mockResolvedValueOnce({name:'bullet',disabled:false,disposed:false,step:()=>({simulated:true}),dispose}).mockRejectedValueOnce(Error('world unavailable'));
    try{await expect(rt.setPhysicsEnabled(true)).rejects.toThrow('world unavailable');expect(rt.listModels()).toEqual(before);expect(rt.selectedId).toBe(a.modelId);
      before.forEach((m,i)=>expect(rt.getModelRoot(m.id)).toBe(roots[i]));expect(load).toHaveBeenCalledTimes(2);expect(dispose).toHaveBeenCalledOnce();
    }finally{rt.dispose()}
  });

  it('cold-restores the previous mode after a partial two-actor commit, releasing both replacement worlds',async()=>{
    const load=vi.spyOn(ThreeMmdLoader.prototype,'loadModel').mockImplementation(async()=>{
      const model=modelFixture();let current=model.runtime;
      Object.defineProperty(model,'runtime',{get:()=>current});model.exchangeRuntime=next=>{const previous=current;current=next;return previous};return model;
    });
    const file=new File(['x'],'m.pmx'),rt=createMmdRuntimeHandle(new THREE.Scene());const a=await rt.addModel(file),b=await rt.addModel(file);
    const second=await load.mock.results[1].value as ThreeMmdModel;vi.spyOn(second,'exchangeRuntime').mockImplementationOnce(()=>{throw Error('bind failed')});
    rt.selectModel(a.modelId);rt.setModelTransform(b.modelId,{scale:.21,positionX:4});const before=rt.listModels();
    const releases=[vi.fn(),vi.fn()];for(const dispose of releases)vi.mocked(createBulletPhysicsBackend).mockResolvedValueOnce({name:'bullet',disabled:false,disposed:false,step:()=>({simulated:true}),dispose});
    try{await expect(rt.setPhysicsEnabled(true)).rejects.toThrow('bind failed');expect(load).toHaveBeenCalledTimes(4);expect(rt.listModels()).toEqual(before);expect(rt.selectedId).toBe(a.modelId);
      releases.forEach(fn=>expect(fn).toHaveBeenCalledOnce());await rt.setPhysicsEnabled(false);expect(load).toHaveBeenCalledTimes(4);
    }finally{rt.dispose()}
  });
});
