export { createAppXrStore, type AppXrStore } from "./createAppXrStore";
export {
  AttachPendingXrSession,
  HeadsetHudGate,
  XrSessionSync,
  type AttachPendingXrSessionProps,
} from "./AttachPendingXrSession";
export { createPendingSessionSlot, type PendingSessionSlot } from "./pendingSessionSlot";
export {
  createProductXrSession,
  type ProductXrSession,
} from "./createProductXrSession";
export {
  requestImmersiveEnter,
  type ImmersiveEnterResult,
  type RequestImmersiveEnterOpts,
} from "./requestImmersiveEnter";
export {
  applyCommonQualityAxes,
  formatDprLabel,
  formatFrameRateLabel,
  formatOnOff,
  IMMERSIVE_DPR_MAP,
  normalizeImmersiveAntialias,
  normalizeImmersiveDpr,
  normalizeImmersiveFrameRate,
  normalizeImmersiveFramebufferScale,
  normalizeImmersiveFoveation,
  normalizeImmersiveQuality,
  normalizeImmersiveToggle,
  scalePanelSize,
  type CommonQualityAxes,
  type CommonQualityPrefs,
  type ImmersiveAntialiasPref,
  type ImmersiveDprPref,
  type ImmersiveFrameRate,
  type ImmersiveFrameRatePref,
  type ImmersiveFramebufferScalePref,
  type ImmersiveFoveationPref,
  type ImmersiveRenderQuality,
  type ImmersiveTogglePref,
} from "./qualityAxes";
export { createXrSceneMountGuard, type XrSceneLifecycleOpts } from "./useXrSceneLifecycle";
export {
  XR_THEME_COLORS,
  getSystemXrAccentTokens,
  getXrAccentTokens,
  hexToRgba,
  normalizeXrThemeColor,
  type XrAccentTokens,
  type XrThemeColor,
  type XrThemeMode,
} from "./themeColor";
export {
  buildQuestVrSessionInit,
  formatXrSessionError,
  getXrDiagnostics,
  getXrSystem,
  type XrDiagnostics,
} from "./xrDetect";
