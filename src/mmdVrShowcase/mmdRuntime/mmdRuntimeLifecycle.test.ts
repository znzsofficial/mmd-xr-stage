import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { ThreeMmdLoader, type ThreeMmdModel } from "@yohawing/three-mmd-loader";
import { createBulletPhysicsBackend } from "./mmdPhysics";
import { createLocalTextureResolver, createMmdRuntimeHandle } from "./mmdRuntime";
import { expandAssetFiles } from "../../mmdImport/importArchive";
import { BlobWriter, TextReader, ZipWriter } from "@zip.js/zip.js";
import { bindCompanion } from "../../mmdImport/assetPaths";
import { createModelLoadTask } from "../modelLoadTask";
import { createAssetLoadQueue } from "../mmdAssetLoadQueue";
import { createRoomMotionCache } from './roomMotionCache';

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
    vi.spyOn(ThreeMmdLoader.prototype, "loadModel").mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const runtime = createMmdRuntimeHandle(scene);
    const pending = runtime.addModel(new File(["pmx"], "model.pmx"));
    runtime[end]();
    resolve(model);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(scene.children).toHaveLength(0);
    expect(dispose).toHaveBeenCalledOnce();
    expect((model.runtime as unknown as { dispose: () => void }).dispose).toHaveBeenCalledOnce();
    runtime.dispose();
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

  it("rolls back a failed motion bind on the raw solver pose, not the displayed hem", async () => {
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
        expect(hem.position.y).toBe(rawY);
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
