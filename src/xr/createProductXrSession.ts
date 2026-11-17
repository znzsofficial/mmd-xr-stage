import type { WebGLRenderer } from "three";
import type { XRStoreOptions } from "@react-three/xr";
import { createAppXrStore, type AppXrStore } from "./createAppXrStore";
import { createPendingSessionSlot, type PendingSessionSlot } from "./pendingSessionSlot";
import type { ImmersiveFrameRate } from "./qualityAxes";

export type ProductXrSession<Q> = {
  xrStore: AppXrStore;
  slot: PendingSessionSlot;
  peek: () => XRSession | null;
  beginFromClick: (init?: XRSessionInit) => Promise<XRSession>;
  applyFrameRate: (quality: Q) => void;
  attachToRenderer: (gl: WebGLRenderer, quality?: Q, signal?: AbortSignal) => Promise<boolean>;
  end: (generation?: number) => Promise<void>;
};

/**
 * One XR store + pending slot + frame-rate apply for a product surface.
 * Call once per surface (desktop / MMD) — never share the returned instance.
 */
export function createProductXrSession<Q>(opts: {
  resolveFrameRate: (quality: Q) => ImmersiveFrameRate;
  configureRenderer?: (gl: WebGLRenderer, quality: Q) => void;
  controller?: XRStoreOptions["controller"];
  onSessionEnd?: () => void;
}): ProductXrSession<Q> {
  const xrStore = createAppXrStore({ controller: opts.controller });
  const slot = createPendingSessionSlot({ onSessionEnd: opts.onSessionEnd });

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
    beginFromClick: (init) => slot.beginFromClick(init),
    applyFrameRate,
    attachToRenderer: (gl, quality, signal) => slot.attachToRenderer(
      gl,
      quality !== undefined ? () => applyFrameRate(quality) : undefined,
      { signal, beforeAttach: () => { if (quality !== undefined) opts.configureRenderer?.(gl, quality); } },
    ),
    end: (generation) => slot.end(generation),
  };
}
