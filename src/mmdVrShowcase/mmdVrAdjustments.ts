export const MMD_VR_MODEL_SCALE_STEPS = [
  0.01, 0.02, 0.03, 0.05, 0.075, 0.1, 0.15, 0.2, 0.25, 0.35, 0.5, 0.65, 0.8, 1,
  1.25, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10,
] as const;

export const MMD_VR_HEIGHT_OFFSET_MIN = -5;
export const MMD_VR_HEIGHT_OFFSET_MAX = 50;
export const MMD_VR_HEIGHT_OFFSET_STEP = 0.1;
export const MMD_VR_HEIGHT_OFFSET_FINE_STEP = 0.01;
export const MMD_VR_MODEL_SCALE_MIN = 0.01;
export const MMD_VR_MODEL_SCALE_MAX = 10;
export const MMD_VR_VIEW_DISTANCE_MIN = 10;
export const MMD_VR_VIEW_DISTANCE_MAX = 100;

export function normalizeMmdVrModelScale(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 1;
  return Math.round(Math.min(MMD_VR_MODEL_SCALE_MAX, Math.max(MMD_VR_MODEL_SCALE_MIN, n)) * 1000) / 1000;
}

export function mmdVrModelScaleToSlider(value: number): number {
  const scale = normalizeMmdVrModelScale(value);
  return Math.log(scale / MMD_VR_MODEL_SCALE_MIN) / Math.log(MMD_VR_MODEL_SCALE_MAX / MMD_VR_MODEL_SCALE_MIN);
}

export function mmdVrSliderToModelScale(value: number): number {
  const ratio = Math.min(1, Math.max(0, value));
  return normalizeMmdVrModelScale(
    MMD_VR_MODEL_SCALE_MIN * Math.pow(MMD_VR_MODEL_SCALE_MAX / MMD_VR_MODEL_SCALE_MIN, ratio),
  );
}

export function fineTuneMmdVrModelScale(value: number, direction: -1 | 1): number {
  const factor = direction < 0 ? 1 / 1.05 : 1.05;
  return normalizeMmdVrModelScale(value * factor);
}

export function previousMmdVrModelScale(value: number): number {
  const current = normalizeMmdVrModelScale(value);
  for (let i = MMD_VR_MODEL_SCALE_STEPS.length - 1; i >= 0; i -= 1) {
    if (MMD_VR_MODEL_SCALE_STEPS[i] < current - 1e-6) return MMD_VR_MODEL_SCALE_STEPS[i];
  }
  return MMD_VR_MODEL_SCALE_STEPS[0];
}

export function nextMmdVrModelScale(value: number): number {
  const current = normalizeMmdVrModelScale(value);
  for (const step of MMD_VR_MODEL_SCALE_STEPS) {
    if (step > current + 1e-6) return step;
  }
  return MMD_VR_MODEL_SCALE_STEPS[MMD_VR_MODEL_SCALE_STEPS.length - 1];
}

export function normalizeMmdVrHeightOffset(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.round(Math.min(MMD_VR_HEIGHT_OFFSET_MAX, Math.max(MMD_VR_HEIGHT_OFFSET_MIN, n)) * 100) / 100;
}

export function normalizeMmdVrViewDistance(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 40;
  return Math.round(Math.min(MMD_VR_VIEW_DISTANCE_MAX, Math.max(MMD_VR_VIEW_DISTANCE_MIN, n)));
}

export function mmdVrViewDistanceToSlider(value: number): number {
  return (normalizeMmdVrViewDistance(value) - MMD_VR_VIEW_DISTANCE_MIN) /
    (MMD_VR_VIEW_DISTANCE_MAX - MMD_VR_VIEW_DISTANCE_MIN);
}

export function mmdVrSliderToViewDistance(value: number): number {
  const ratio = Math.min(1, Math.max(0, value));
  return normalizeMmdVrViewDistance(
    MMD_VR_VIEW_DISTANCE_MIN + ratio * (MMD_VR_VIEW_DISTANCE_MAX - MMD_VR_VIEW_DISTANCE_MIN),
  );
}

export function mmdVrHeightOffsetToSlider(value: number): number {
  return (normalizeMmdVrHeightOffset(value) - MMD_VR_HEIGHT_OFFSET_MIN) /
    (MMD_VR_HEIGHT_OFFSET_MAX - MMD_VR_HEIGHT_OFFSET_MIN);
}

export function mmdVrSliderToHeightOffset(value: number): number {
  const ratio = Math.min(1, Math.max(0, value));
  return normalizeMmdVrHeightOffset(
    MMD_VR_HEIGHT_OFFSET_MIN + ratio * (MMD_VR_HEIGHT_OFFSET_MAX - MMD_VR_HEIGHT_OFFSET_MIN),
  );
}

export function formatMmdVrModelScale(value: number): string {
  const scale = normalizeMmdVrModelScale(value);
  if (scale < 0.1) return `${scale.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")}x`;
  return `${scale.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}x`;
}
