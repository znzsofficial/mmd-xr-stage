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
  it("disposes a model arriving after the runtime has been closed", async () => {
    const scene = new THREE.Scene();
    const model = modelFixture();
    const dispose = vi.spyOn(model.mesh.geometry, "dispose");
    let resolve!: (model: ThreeMmdModel) => void;
    vi.spyOn(ThreeMmdLoader.prototype, "loadModel").mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const runtime = createMmdRuntimeHandle(scene);
    const pending = runtime.addModel(new File(["pmx"], "model.pmx"));
    runtime.dispose();
    resolve(model);
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(scene.children).toHaveLength(0);
    expect(dispose).toHaveBeenCalledOnce();
    expect((model.runtime as unknown as { dispose: () => void }).dispose).toHaveBeenCalledOnce();
  });

  it("converts controller coordinates and radius independently of visual model scale", async () => {
    const model = modelFixture();
    vi.spyOn(ThreeMmdLoader.prototype, "loadModel").mockResolvedValue(model);
    const dispose = vi.fn();
    vi.mocked(createBulletPhysicsBackend).mockResolvedValue({ name: "bullet", disabled: false, disposed: false, step: () => ({ simulated: true }), dispose });
    const runtime = createMmdRuntimeHandle(new THREE.Scene(), {
      controllerColliders: () => [new THREE.Matrix4().makeTranslation(1, 2, 3), new THREE.Matrix4()],
      controllerColliderRadius: () => 0.08,
    });
    try {
      const { modelId } = await runtime.addModel(new File(["pmx"], "model.pmx"), [], { physics: true, transform: { scale: 0.2 } });
      const options = vi.mocked(createBulletPhysicsBackend).mock.lastCall![0]!;
      const matrix = options.controllerColliders!()[0];
      expect([...matrix.slice(12, 15)]).toEqual([5, 10, -15]);
      expect((options.controllerRadius as () => number)()).toBeCloseTo(0.4);
      runtime.setModelTransform(modelId, { scale: 0.4 });
      expect((options.controllerRadius as () => number)()).toBeCloseTo(0.2);
    } finally { runtime.dispose(); }
    expect(dispose).toHaveBeenCalledOnce();
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
});
