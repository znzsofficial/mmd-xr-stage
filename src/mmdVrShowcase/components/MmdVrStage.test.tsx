// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as THREE from "three";
import { afterEach, expect, it, vi } from "vitest";
import { MmdVrStageContent } from "./MmdVrStage";
import { createMmdRuntimeHandle } from "../mmdRuntime/mmdRuntime";
import { beginMmdVrAssetSession, endMmdVrAssetSession } from "../mmdVrAssets";
import { useMmdVrStore } from "../mmdVrStore";
import { getMmdVrClock } from "../mmdVrClock";

const harness = vi.hoisted(() => ({
  three: {} as Record<string, unknown>,
  frame: null as null | ((state: unknown, delta: number) => void),
}));
vi.mock("@react-three/fiber", () => ({
  useThree: () => harness.three,
  useFrame: (callback: typeof harness.frame) => { harness.frame = callback; },
}));
vi.mock("../mmdVrTheme", () => ({ useMmdVrTheme: () => ({ accent: {} }) }));
vi.mock("../mmdRuntime/mmdRuntime", () => ({ createMmdRuntimeHandle: vi.fn(), isMmdRuntimeRebuildError: () => false }));

function LifecycleHarness() {
  MmdVrStageContent();
  return null;
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); endMmdVrAssetSession(); });

it("keeps paused motion and HUD time fixed while forwarding the frame delta, and reseeds on scrub and loop", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  harness.three = { scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), size: { width: 640, height: 480 }, gl: {} };
  const update = vi.fn();
  const runtime = { duration: 2, update, dispose: vi.fn(), listModels: () => [], exportProjectModels: () => [], setPhysicsEnabled: vi.fn(async () => {}) };
  vi.mocked(createMmdRuntimeHandle).mockReturnValue(runtime as unknown as ReturnType<typeof createMmdRuntimeHandle>);
  const s = useMmdVrStore.getState(); s.openOverlay();
  useMmdVrStore.setState({ playing: false, loop: true, physicsEnabled: true, physicsBusy: false, physicsControllerCollisions: true });
  const root = createRoot(document.createElement("div"));
  const frame = async () => { await act(async () => harness.frame?.({}, 1 / 90)); return update.mock.lastCall!; };
  try {
    await act(async () => root.render(<LifecycleHarness />));
    await act(async () => s.requestSeek(0.75));
    expect((await frame())[6]).toBe(true);
    const paused = await frame();
    expect([paused[0], paused[1], paused[5], paused[6]]).toEqual([0.75, true, 1 / 90, false]);
    expect(getMmdVrClock().time).toBe(0.75);
    await act(async () => s.setPhysicsControllerCollisions(false));
    expect((await frame())[5]).toBe(0);
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
