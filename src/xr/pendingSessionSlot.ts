import type { WebGLRenderer } from "three";
import { buildQuestVrSessionInit, getXrDiagnostics, getXrSystem } from "./xrDetect";

/**
 * One pending XRSession slot + serialized attach queue.
 * Create one per product surface so sessions never share pending state.
 */
export type PendingSessionSlot = {
  peek: () => XRSession | null;
  clear: () => void;
  /** MUST run synchronously from a click handler (no await before this call). */
  beginFromClick: (init?: XRSessionInit) => Promise<XRSession>;
  /**
   * Bind pending XRSession to this renderer's WebXRManager.
   * Keeps pending for remount re-bind; cleared only on session end / end().
   */
  attachToRenderer: (gl: WebGLRenderer, onAttached?: () => void) => Promise<boolean>;
  end: (getLiveSession?: () => XRSession | null | undefined) => Promise<void>;
};

export function createPendingSessionSlot(): PendingSessionSlot {
  let pendingSession: XRSession | null = null;
  let attachChain: Promise<unknown> = Promise.resolve();

  function peek() {
    return pendingSession;
  }

  function clear() {
    pendingSession = null;
  }

  function beginFromClick(init?: XRSessionInit): Promise<XRSession> {
    const xr = getXrSystem();
    if (!xr) {
      return Promise.reject(new Error(`WebXR missing (${getXrDiagnostics().summary})`));
    }
    if (typeof globalThis !== "undefined") {
      const secure =
        typeof (globalThis as { isSecureContext?: boolean }).isSecureContext === "boolean"
          ? Boolean((globalThis as { isSecureContext?: boolean }).isSecureContext)
          : typeof window !== "undefined"
            ? window.isSecureContext
            : true;
      if (!secure) {
        return Promise.reject(new Error(`Insecure context (${getXrDiagnostics().summary})`));
      }
    }

    if (pendingSession) {
      try {
        void pendingSession.end();
      } catch {
        // ignore
      }
      pendingSession = null;
    }

    return xr.requestSession("immersive-vr", init ?? buildQuestVrSessionInit()).then((session) => {
      pendingSession = session;
      session.addEventListener(
        "end",
        () => {
          if (pendingSession === session) pendingSession = null;
        },
        { once: true },
      );
      return session;
    });
  }

  function attachToRenderer(gl: WebGLRenderer, onAttached?: () => void): Promise<boolean> {
    const run = async (): Promise<boolean> => {
      const session = pendingSession;
      if (!session) return Boolean(gl.xr?.isPresenting);

      if (gl.xr?.enabled && gl.xr.isPresenting) {
        onAttached?.();
        return true;
      }

      gl.xr.enabled = true;
      await gl.xr.setSession(session);
      onAttached?.();
      return true;
    };

    const next = attachChain.then(run, run);
    attachChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async function end(getLiveSession?: () => XRSession | null | undefined): Promise<void> {
    const pending = pendingSession;
    pendingSession = null;

    if (pending) {
      try {
        await pending.end();
      } catch {
        // ignore
      }
    }

    try {
      const live = getLiveSession?.();
      if (live) await live.end();
    } catch {
      // ignore
    }
  }

  return { peek, clear, beginFromClick, attachToRenderer, end };
}
