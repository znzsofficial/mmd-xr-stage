import type { WebGLRenderer } from "three";
import { buildQuestVrSessionInit, getXrDiagnostics, getXrSystem } from "./xrDetect";
import { waitForXrOperation } from "./waitForXrOperation";

export type XrStartupPhase = "idle" | "requesting" | "created" | "bound" | "presenting";
export type XrSessionSnapshot = Readonly<{
  generation: number;
  phase: XrStartupPhase;
  session: XRSession | null;
}>;
export type XrAttachOptions = {
  signal?: AbortSignal;
  beforeAttach?: () => void;
};

export type PendingSessionSlot = {
  peek: () => XRSession | null;
  getSnapshot: () => XrSessionSnapshot;
  subscribe: (listener: () => void) => () => void;
  beginFromClick: (init?: XRSessionInit) => Promise<XRSession>;
  attachToRenderer: (gl: WebGLRenderer, onAttached?: () => void, options?: XrAttachOptions) => Promise<boolean>;
  markFrame: (gl: WebGLRenderer, session: XRSession) => boolean;
  waitForPresentation: (signal?: AbortSignal) => Promise<XRSession>;
  end: (generation?: number) => Promise<void>;
};

export function createPendingSessionSlot(options: { onSessionEnd?: () => void } = {}): PendingSessionSlot {
  let snapshot: XrSessionSnapshot = { generation: 0, phase: "idle", session: null };
  let boundRenderer: WebGLRenderer | null = null;
  const listeners = new Set<() => void>();
  const attachChains = new WeakMap<WebGLRenderer, Promise<unknown>>();
  const endingSessions = new WeakMap<XRSession, Promise<void>>();

  function publish(phase: XrStartupPhase, session = snapshot.session, generation = snapshot.generation) {
    snapshot = { generation, phase, session };
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }

  function endOnce(session: XRSession): Promise<void> {
    const existing = endingSessions.get(session);
    if (existing) return existing;
    const ending = Promise.resolve().then(() => session.end()).catch(() => undefined);
    endingSessions.set(session, ending);
    return ending;
  }

  function waitFor(ready: (state: XrSessionSnapshot) => boolean, signal?: AbortSignal): Promise<XRSession> {
    const generation = snapshot.generation;
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        unsubscribe();
        signal?.removeEventListener("abort", cancel);
      };
      const cancel = () => {
        cleanup();
        reject(new DOMException("XR entry cancelled", "AbortError"));
      };
      const check = () => {
        if (signal?.aborted || snapshot.generation !== generation || snapshot.phase === "idle") {
          cancel();
        } else if (snapshot.session && ready(snapshot)) {
          cleanup();
          resolve(snapshot.session);
        }
      };
      const unsubscribe = subscribe(check);
      signal?.addEventListener("abort", cancel, { once: true });
      check();
    });
  }

  function beginFromClick(init?: XRSessionInit): Promise<XRSession> {
    const previous = snapshot.session;
    boundRenderer = null;
    const generation = snapshot.generation + 1;
    publish("requesting", null, generation);
    if (previous) void endOnce(previous);
    const xr = getXrSystem();
    if (!xr || !getXrDiagnostics().secure) {
      publish("idle");
      return Promise.reject(new Error(`WebXR unavailable (${getXrDiagnostics().summary})`));
    }
    let request: Promise<XRSession>;
    try {
      request = xr.requestSession("immersive-vr", init ?? buildQuestVrSessionInit());
    } catch (error) {
      publish("idle");
      return Promise.reject(error);
    }
    return request.then((session) => {
      if (generation !== snapshot.generation) {
        void endOnce(session);
        throw new DOMException("XR entry cancelled", "AbortError");
      }
      session.addEventListener("end", () => {
        if (snapshot.generation !== generation || snapshot.session !== session) return;
        endingSessions.set(session, Promise.resolve());
        boundRenderer = null;
        publish("idle", null, generation + 1);
        options.onSessionEnd?.();
      }, { once: true });
      publish("created", session);
      return session;
    }, (error) => {
      if (snapshot.generation === generation) publish("idle");
      throw error;
    });
  }

  function attachToRenderer(gl: WebGLRenderer, onAttached?: () => void, attachOptions: XrAttachOptions = {}): Promise<boolean> {
    const generation = snapshot.generation;
    const sessionReady = waitFor((state) => state.session !== null, attachOptions.signal);
    const run = async (session: XRSession): Promise<boolean> => {
      const current = () => snapshot.generation === generation && snapshot.session === session;
      if (!current() || attachOptions.signal?.aborted) return false;
      if (!(gl.xr.isPresenting && gl.xr.getSession() === session)) {
        attachOptions.beforeAttach?.();
        gl.xr.enabled = true;
        await gl.xr.setSession(session);
      }
      if (!current()) {
        void endOnce(session);
        return false;
      }
      if (attachOptions.signal?.aborted) return false;
      if (!gl.xr.isPresenting || gl.xr.getSession() !== session) {
        throw new Error("XR renderer did not bind the requested session");
      }
      const sameRenderer = boundRenderer === gl;
      boundRenderer = gl;
      if (!sameRenderer || snapshot.phase !== "presenting") publish("bound");
      onAttached?.();
      return true;
    };
    const next = sessionReady.then((session) => {
      const chain = attachChains.get(gl) ?? Promise.resolve();
      const operation = chain.then(() => run(session), () => run(session));
      attachChains.set(gl, operation.catch(() => undefined));
      return operation;
    });
    return waitForXrOperation(next, { signal: attachOptions.signal });
  }

  function markFrame(gl: WebGLRenderer, session: XRSession): boolean {
    if (snapshot.session !== session || boundRenderer !== gl || !gl.xr.isPresenting || gl.xr.getSession() !== session) return false;
    if (snapshot.phase === "bound") publish("presenting");
    return snapshot.phase === "presenting";
  }

  function end(generation = snapshot.generation): Promise<void> {
    if (generation !== snapshot.generation) return Promise.resolve();
    const session = snapshot.session;
    boundRenderer = null;
    publish("idle", null, snapshot.generation + 1);
    return session ? endOnce(session) : Promise.resolve();
  }

  return {
    peek: () => snapshot.session,
    getSnapshot: () => snapshot,
    subscribe,
    beginFromClick,
    attachToRenderer,
    markFrame,
    waitForPresentation: (signal) => waitFor((state) => state.phase === "presenting", signal),
    end,
  };
}
