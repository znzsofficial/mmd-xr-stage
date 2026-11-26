import type { WebGLRenderer } from "three";
import { HUD_RAY } from "../hud/hudPointer";
import { bindHandVisibility } from './handVisibility';
import { buildQuestVrSessionInit, createProductXrSession } from "../../xr";
import { getMmdVrRenderProfile, type MmdVrQualityInput } from "../settings/mmdVrQuality";
import { useMmdVrStore, type MmdVrRenderQuality } from "../mmdVrStore";

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
    rayPointer: HUD_RAY,
  },
  onSessionEnd: () => {
    const s=useMmdVrStore.getState();
    if (s.overlayOpen && s.presentation==='xr') s.closeOverlay();
  },
});

export const mmdVrXrStore = session.xrStore;

bindHandVisibility(session.xrStore);

export function peekPendingMmdVrSession() {
  return session.peek();
}

export const getMmdVrSessionSnapshot = session.slot.getSnapshot;
export const markMmdVrXrFrame = session.slot.markFrame;
export const waitForMmdVrPresentation = session.slot.waitForPresentation;

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
  signal?: AbortSignal,
): Promise<boolean> {
  return session.attachToRenderer(gl, quality, signal);
}

export function endMmdVrSession(generation?: number): Promise<void> {
  return session.end(generation);
}
