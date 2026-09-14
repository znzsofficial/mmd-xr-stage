/** Max concurrent character models in the showcase (roadmap v0). */
export const MMD_VR_MAX_MODELS = 3;

/** Max concurrent glTF/GLB environment objects (roadmap A6). Matches HUD panel count. */
export const MMD_VR_MAX_OBJECTS = 3;

export type MmdVrModelSlot = {
  kind: "model";
  modelFile: File;
  companionFiles: File[];
  bodyMotionFile: File | null;
  faceMotionFile?: File | null;
};

export type MmdVrObjectSlot = {
  kind: "object";
  objectFile: File;
  companionFiles: File[];
};

export type MmdVrAssetSlot = MmdVrModelSlot | MmdVrObjectSlot;

function normalizeModelSlot(slot: MmdVrModelSlot): MmdVrModelSlot {
  return {
    kind: "model",
    modelFile: slot.modelFile,
    companionFiles: slot.companionFiles?.length ? [...slot.companionFiles] : [slot.modelFile],
    bodyMotionFile: slot.bodyMotionFile ?? null,
    faceMotionFile: slot.faceMotionFile ?? null,
  };
}

function normalizeObjectSlot(slot: MmdVrObjectSlot): MmdVrObjectSlot {
  return {
    kind: "object",
    objectFile: slot.objectFile,
    companionFiles: slot.companionFiles?.length ? [...slot.companionFiles] : [slot.objectFile],
  };
}

function normalizeSlots(slots: readonly MmdVrAssetSlot[]): MmdVrAssetSlot[] {
  const models = slots
    .filter((slot): slot is MmdVrModelSlot => slot.kind === "model")
    .slice(0, MMD_VR_MAX_MODELS)
    .map(normalizeModelSlot);
  const objects = slots
    .filter((slot): slot is MmdVrObjectSlot => slot.kind === "object")
    .slice(0, MMD_VR_MAX_OBJECTS)
    .map(normalizeObjectSlot);
  return [...models, ...objects];
}

/** Staged by enter click; moved into sessionAssets on successful requestSession. */
let pendingAssets: MmdVrAssetSlot[] = [];

/**
 * Active handoff for the current XR overlay.
 * Survives React Strict Mode remounts (do not clear on scene unmount).
 * Cleared on overlay close / enter fail.
 */
let sessionAssets: MmdVrAssetSlot[] | null = null;

export function setMmdVrPendingAssets(slots: readonly MmdVrAssetSlot[]) {
  pendingAssets = normalizeSlots(slots);
}

export function peekMmdVrPendingAssets(): readonly MmdVrAssetSlot[] {
  return pendingAssets;
}

/** @deprecated prefer begin/get session; kept for tests */
export function takeMmdVrPendingAssets(): MmdVrAssetSlot[] {
  const next = pendingAssets;
  pendingAssets = [];
  return next;
}

/**
 * After requestSession succeeds: promote pending → session (or keep existing session).
 * Safe to call on remount — does not wipe sessionAssets.
 */
export function beginMmdVrAssetSession(slots?: readonly MmdVrAssetSlot[]) {
  if (slots?.length) {
    sessionAssets = normalizeSlots(slots);
    pendingAssets = [];
    return;
  }
  if (pendingAssets.length) {
    sessionAssets = pendingAssets;
    pendingAssets = [];
  }
}

export function getMmdVrSessionAssets(): readonly MmdVrAssetSlot[] {
  return sessionAssets ?? [];
}

export function clearMmdVrPendingAssets() {
  pendingAssets = [];
}

export function endMmdVrAssetSession() {
  sessionAssets = null;
  pendingAssets = [];
}

export function clearMmdVrPendingAssetsAll() {
  endMmdVrAssetSession();
}
