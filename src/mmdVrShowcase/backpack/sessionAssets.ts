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

/** Entry owns the initial slots for one screen or XR viewing session. React
 * remounts read the same slots; closing or failing the entry releases them. */
let sessionAssets: readonly MmdVrAssetSlot[] = [];
type StageScope = 'full' | 'soloFloor';
let scope: StageScope = 'full';

/** Immutable while a room is mounted. Limits apply to instances, never to the file library. */
export const isSoloFloorSession = () => scope === 'soloFloor';
export function stageAssetLimit(kind: 'model' | 'object') {
  if (isSoloFloorSession()) return kind === 'model' ? 1 : 0;
  return kind === 'model' ? MMD_VR_MAX_MODELS : MMD_VR_MAX_OBJECTS;
}

export function beginMmdVrAssetSession(slots: readonly MmdVrAssetSlot[], nextScope: StageScope = 'full') {
  if (nextScope === 'soloFloor' && (slots.length > 1 || slots.some(slot => slot.kind !== 'model'))) {
    throw new Error('This floor supports one character and no imported objects.');
  }
  sessionAssets = normalizeSlots(slots);
  scope = nextScope;
}

export function getMmdVrSessionAssets(): readonly MmdVrAssetSlot[] {
  return sessionAssets;
}

export function endMmdVrAssetSession() {
  sessionAssets = [];
  scope = 'full';
}
