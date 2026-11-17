import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebXRManager } from "three";
import { createAppXrStore } from "./createAppXrStore";

const origin = "https://stage.example";
const assetRoot = "/xr-input/1.0.20/";
const publicRoot = new URL("../../public/", import.meta.url);

async function readPublic(path: string) {
  return readFile(new URL(path.replace(/^\//, ""), publicRoot));
}

describe("same-origin XR input assets", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("establishes Quest controllers and hands without a third-party network request", async () => {
    vi.stubGlobal("location", { href: `${origin}/` });
    vi.stubGlobal("navigator", { xr: undefined });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.origin !== origin) throw new Error(`External input dependency: ${url}`);
      return new Response(await readPublic(url.pathname));
    });
    vi.stubGlobal("fetch", fetchMock);
    const controller = {
      handedness: "right", targetRayMode: "tracked-pointer",
      profiles: ["meta-quest-touch-plus", "oculus-touch-v3", "generic-trigger-squeeze-thumbstick"],
    } as unknown as XRInputSource;
    const events = new EventTarget();
    const session = Object.assign(events, {
      environmentBlendMode: "opaque", frameRate: 72,
      inputSources: [controller], visibilityState: "visible",
    }) as unknown as XRSession;
    let start: (() => void) | undefined;
    const manager = {
      addEventListener: (type: string, listener: () => void) => { if (type === "sessionstart") start = listener; },
      removeEventListener: vi.fn(), getSession: () => session,
      setFoveation: vi.fn(), setReferenceSpaceType: vi.fn(),
    } as unknown as WebXRManager;
    const store = createAppXrStore();
    try {
      store.setWebXRManager(manager);
      start?.();
      await vi.waitFor(() => expect(store.getState().inputSourceStates).toHaveLength(1));
      const state = store.getState().inputSourceStates[0];
      expect(state.type).toBe("controller");
      if (state.type !== "controller") throw new Error("Controller missing");
      expect(state.layout.components["b-button"].gamepadIndices?.button).toBe(5);
      expect(state.layout.components["xr-standard-thumbstick"].gamepadIndices?.yAxis).toBe(3);
      expect(state.layout.assetPath).toBe(`${origin}${assetRoot}meta-quest-touch-plus/right.glb`);

      const hand = { handedness: "right", hand: new Map(), profiles: ["generic-hand"], targetRayMode: "tracked-pointer" } as unknown as XRInputSource;
      events.dispatchEvent(Object.assign(new Event("inputsourceschange"), { added: [hand], removed: [controller] }));
      const handState = store.getState().inputSourceStates[0];
      expect(handState.type).toBe("hand");
      if (handState.type !== "hand") throw new Error("Hand missing");
      expect(handState.assetPath).toBe(`${origin}${assetRoot}generic-hand/right.glb`);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      store.destroy();
    }
  });

  it("ships every indexed profile and its self-contained GLB models, including both hands", async () => {
    const list = JSON.parse((await readPublic(`${assetRoot}profilesList.json`)).toString()) as Record<string, { path: string }>;
    const models = new Set([`${assetRoot}generic-hand/left.glb`, `${assetRoot}generic-hand/right.glb`]);
    for (const { path } of Object.values(list)) {
      const url = new URL(`${assetRoot}${path}`, origin);
      const profile = JSON.parse((await readPublic(url.pathname)).toString()) as { layouts: Record<string, { assetPath: string }> };
      for (const layout of Object.values(profile.layouts)) {
        const model = new URL(layout.assetPath, url);
        expect(model.origin).toBe(origin);
        models.add(model.pathname);
      }
    }
    for (const path of models) {
      const glb = await readPublic(path);
      expect(glb.subarray(0, 4).toString(), path).toBe("glTF");
      expect(glb.readUInt32LE(8), path).toBe(glb.length);
      const json = JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString());
      for (const entry of [...(json.images ?? []), ...(json.buffers ?? [])]) {
        expect(entry.uri == null || entry.uri.startsWith("data:"), `${path}: external resource`).toBe(true);
      }
    }
  });
});
