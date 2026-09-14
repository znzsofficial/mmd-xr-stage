import type { WebGLRenderer } from "three";
import type { XRStoreOptions } from "@react-three/xr";
import { createAppXrStore, type AppXrStore } from "./createAppXrStore";
import { createPendingSessionSlot, type PendingSessionSlot } from "./pendingSessionSlot";
import type { ImmersiveFrameRate } from "./qualityAxes";

export type ProductXrSession<Q> = {
  xrStore: AppXrStore;
  slot: PendingSessionSlot;
  peek: () => XRSession | null;
  clear: () => void;
  beginFromClick: (init?: XRSessionInit) => Promise<XRSession>;
  applyFrameRate: (quality: Q) => void;
  attachToRenderer: (gl: WebGLRenderer, quality?: Q) => Promise<boolean>;
  end: () => Promise<void>;
};

/**
 * One XR store + pending slot + frame-rate apply for a product surface.
 * Call once per surface (desktop / MMD) — never share the returned instance.
 */
export function createProductXrSession<Q>(opts: {
  resolveFrameRate: (quality: Q) => ImmersiveFrameRate;
  configureRenderer?: (gl: WebGLRenderer, quality: Q) => void;
  controller?: XRStoreOptions["controller"];
}): ProductXrSession<Q> {
  const xrStore = createAppXrStore({ controller: opts.controller });
  const slot = createPendingSessionSlot();

  function applyFrameRate(quality: Q) {
    try {
      xrStore.setFrameRate(opts.resolveFrameRate(quality));
    } catch {
      // ignore if no session yet
    }
  }

  return {
    xrStore,
    slot,
    peek: () => slot.peek(),
    clear: () => slot.clear(),
    beginFromClick: (init) => slot.beginFromClick(init),
    applyFrameRate,
    attachToRenderer: (gl, quality) => {
      if (quality !== undefined && !gl.xr.isPresenting) opts.configureRenderer?.(gl, quality);
      return slot.attachToRenderer(gl, quality !== undefined ? () => applyFrameRate(quality) : undefined);
    },
    end: () => slot.end(() => xrStore.getState().session),
  };
}
