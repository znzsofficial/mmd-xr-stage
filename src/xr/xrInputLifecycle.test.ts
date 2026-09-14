import { afterEach, describe, expect, it, vi } from "vitest";
import { createXRStore } from "@react-three/xr";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function jsonResponse(value: unknown): Response {
  return {
    ok: true,
    json: vi.fn().mockResolvedValue(value),
  } as unknown as Response;
}

describe("XR controller input lifecycle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("discards a pending controller state when the input source is replaced", async () => {
    const profilesResponse = deferred<Response>();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockReturnValueOnce(profilesResponse.promise)
      .mockReturnValueOnce(profilesResponse.promise)
      .mockResolvedValue(
        jsonResponse({
          profileId: "quest-controller",
          layouts: {
            left: {
              assetPath: "controller.glb",
              components: {},
            },
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("navigator", { xr: undefined });

    const sessionListeners = new Map<string, Set<EventListener>>();
    const addSessionListener = vi.fn((type: string, listener: EventListener) => {
      const listeners = sessionListeners.get(type) ?? new Set<EventListener>();
      listeners.add(listener);
      sessionListeners.set(type, listeners);
    });
    const removeSessionListener = vi.fn((type: string, listener: EventListener) => {
      sessionListeners.get(type)?.delete(listener);
    });
    const emitSessionEvent = (type: string, event: object = {}) => {
      for (const listener of sessionListeners.get(type) ?? []) {
        listener(event as Event);
      }
    };
    const inputSource = {
      handedness: "left",
      hand: null,
      profiles: ["quest-controller"],
      targetRayMode: "tracked-pointer",
    } as unknown as XRInputSource;
    const replacementInputSource = {
      ...inputSource,
    } as XRInputSource;
    const session = {
      addEventListener: addSessionListener,
      removeEventListener: removeSessionListener,
      environmentBlendMode: "opaque",
      frameRate: 72,
      inputSources: [inputSource],
      visibilityState: "visible",
    } as unknown as XRSession;
    let sessionStartListener: EventListener | undefined;
    const manager = {
      addEventListener: vi.fn((type: string, listener: EventListener) => {
        if (type === "sessionstart") sessionStartListener = listener;
      }),
      getSession: vi.fn(() => session),
      removeEventListener: vi.fn(),
      setFoveation: vi.fn(),
      setReferenceSpaceType: vi.fn(),
    } as unknown as import("three").WebXRManager;
    const store = createXRStore({
      baseAssetPath: "https://assets.example/controllers/",
      domOverlay: false,
      emulate: false,
      enterGrantedSession: false,
      offerSession: false,
    });

    store.setWebXRManager(manager);
    sessionStartListener?.(new Event("sessionstart"));
    expect(store.getState().inputSourceStates).toEqual([]);

    emitSessionEvent("inputsourceschange", {
      added: [replacementInputSource],
      removed: [inputSource],
    });
    expect(
      removeSessionListener.mock.calls.filter(([type]) => type.startsWith("select") || type.startsWith("squeeze")),
    ).toHaveLength(6);

    profilesResponse.resolve(
      jsonResponse({
        "quest-controller": { path: "quest/profile.json" },
      }),
    );
    await vi.waitFor(() => expect(store.getState().inputSourceStates).toHaveLength(1));

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(store.getState().inputSourceStates[0]?.inputSource).toBe(replacementInputSource);
    store.destroy();
  });
});
