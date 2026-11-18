// WebXR wrist -Z points into the palm; tip +Z points back along the distal
// phalanx. Dimensions are nominal metres, not per-frame tracking estimates:
// changing Bullet shape definitions recreates the model's physics world.
export const HAND_JOINTS = ["wrist", "index-finger-tip", "middle-finger-tip", "ring-finger-tip", "pinky-finger-tip", "thumb-tip"] as const;
const PALM_HALF_WIDTH = 0.033;
// Radius and distance between the two rounded cap centers, in slot order.
const FINGERS = [[0.009, 0.019], [0.0095, 0.021], [0.0085, 0.018], [0.007, 0.015], [0.011, 0.023]] as const;

export function handReferenceRadius(controllerRadius: number) {
  return PALM_HALF_WIDTH * Math.min(1.25, Math.max(0.8, Math.sqrt(controllerRadius / 0.08)));
}

export function handContactShape(slot: number, referenceRadius: number) {
  const i = slot % HAND_JOINTS.length;
  const s = referenceRadius / PALM_HALF_WIDTH;
  if (i === 0) return { type: "box" as const, size: [referenceRadius, 0.011 * s, 0.038 * s] as const };
  const [radius, length] = FINGERS[i - 1];
  return { type: "capsule" as const, size: [radius * s, length * s, 0] as const };
}

export function handContactLayout(slot: number, worldRadius: number) {
  const shape = handContactShape(slot, worldRadius);
  return { shape, offsetZ: shape.type === "box" ? -shape.size[2] : shape.size[1] / 2,
    rotateX: shape.type === "capsule" ? Math.PI / 2 : 0 };
}
