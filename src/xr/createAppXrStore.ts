import { createXRStore, type XRStoreOptions } from "@react-three/xr";

/**
 * Shared XR store defaults for MMD XR Stage immersive sessions.
 * Each product surface (desktop / MMD) must call this once for its own store instance.
 */
export function createAppXrStore(options: Pick<XRStoreOptions, "controller"> = {}) {
  return createXRStore({
    // Controller states await these profiles; a remote CDN outage disables input,
    // not just the cosmetic models. Keep profiles and hand meshes same-origin.
    baseAssetPath: new URL("xr-input/1.0.20/", new URL(import.meta.env.BASE_URL, globalThis.location?.href ?? "http://localhost/")).href,
    hand: false,
    controller: options.controller ?? true,
    gaze: false,
    screenInput: true,
    transientPointer: true,
    layers: false,
    meshDetection: false,
    planeDetection: false,
    anchors: false,
    hitTest: false,
    depthSensing: false,
    bodyTracking: false,
    handTracking: false,
    domOverlay: false,
    offerSession: false,
    enterGrantedSession: false,
    frameRate: "mid",
    emulate: false,
  });
}

export type AppXrStore = ReturnType<typeof createAppXrStore>;
