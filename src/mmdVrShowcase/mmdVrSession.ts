import type { WebGLRenderer } from "three";
import { buildQuestVrSessionInit, createProductXrSession } from "../xr";
import { getMmdVrRenderProfile, type MmdVrQualityInput } from "./mmdVrQuality";
import { useMmdVrStore, type MmdVrRenderQuality } from "./mmdVrStore";

export type MmdVrAttachQuality = MmdVrRenderQuality | MmdVrQualityInput;

/** Dedicated XR session for MMD showcase — never share with VR desktop. */
const session = createProductXrSession<MmdVrAttachQuality>({
  resolveFrameRate: (quality) => getMmdVrRenderProfile(quality).frameRate,
  configureRenderer: (gl, quality) => {
    if (typeof quality === "string" || !quality.advancedRenderOverrides) return;
    const profile = getMmdVrRenderProfile(quality);
    gl.xr.setFramebufferScaleFactor(profile.framebufferScale);
    gl.xr.setFoveation(profile.foveation);
  },
  controller: {
    rayPointer: {
      rayModel: { color: "#9fd9ff", opacity: 0.62 },
      cursorModel: { color: "#ffffff", opacity: 0.95, size: 0.014, renderOrder: 100 },
    },
  },
});

export const mmdVrXrStore = session.xrStore;

/**
 * Applies the hand-tracking pref to the XR store: enables the articulated hand
 * implementation (with a reachable ray pointer) or falls back to controllers.
 * Hand states only exist while hand tracking is active, so this has no effect
 * when controllers are used.
 */
let appliedHandTracking: boolean | undefined;
function applyHandTracking(handTracking: boolean) {
  if (handTracking === appliedHandTracking) return;
  appliedHandTracking = handTracking;
  session.xrStore.setHand(
    handTracking
      ? {
          rayPointer: {
            rayModel: { color: "#9fd9ff", opacity: 0.62, maxLength: 1.2 },
            cursorModel: { color: "#ffffff", opacity: 0.95, size: 0.014, renderOrder: 100 },
          },
          touchPointer: { hoverRadius: 0.16 },
        }
      : false,
  );
}
applyHandTracking(useMmdVrStore.getState().prefs.handTracking);
useMmdVrStore.subscribe((state) => applyHandTracking(state.prefs.handTracking));

export function peekPendingMmdVrSession() {
  return session.peek();
}

export function clearPendingMmdVrSession() {
  session.clear();
}

export function beginMmdVrSessionFromClick() {
  // WebXR features are fixed for a session. Always request this optional
  // capability so the HUD toggle can enable hand tracking after entering VR.
  return session.beginFromClick(buildQuestVrSessionInit({ handTracking: true }));
}

export function applyMmdVrFrameRate(quality: MmdVrAttachQuality) {
  session.applyFrameRate(quality);
}

export function attachPendingMmdVrSessionToRenderer(
  gl: WebGLRenderer,
  quality?: MmdVrAttachQuality,
): Promise<boolean> {
  return session.attachToRenderer(gl, quality);
}

export function endMmdVrSession(): Promise<void> {
  return session.end();
}
