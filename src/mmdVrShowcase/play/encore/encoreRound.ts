import type { Vector3 } from 'three';
import { create } from 'zustand';

export type Wing = 'left' | 'right';

// Enamel badges on the audience-facing surfaces of the existing speaker stacks.
export const BADGE_X = 4.55;
export const BADGE_Y = 1.57;
export const BADGE_Z = -3.485;
export const BADGE_RADIUS = .39;

/** World-space ray. Do not require normalization or mutate the controller's scratch vectors. */
export function aimEncore(origin: Vector3, dir: Vector3): Wing | null {
  if (!(dir.z < 0)) return null;
  const t = (BADGE_Z - origin.z) / dir.z;
  if (!(t > 0 && t * t * dir.lengthSq() <= 18 * 18)) return null;
  const x = origin.x + t * dir.x, y = origin.y + t * dir.y;
  return (Math.abs(x) - BADGE_X) ** 2 + (y - BADGE_Y) ** 2 <= BADGE_RADIUS ** 2
    ? x < 0 ? 'left' : 'right' : null;
}

// Belongs to the room, not the hand. No tap history to grow or replay on transfer.
type Print = { first: Wing | null; complete: boolean };
export const useEncorePrint = create<Print>(() => ({ first: null, complete: false }));

export function dyeEncore(side: Wing): void {
  const { first, complete } = useEncorePrint.getState();
  if (first === null) useEncorePrint.setState({ first: side });
  else if (first !== side && !complete) useEncorePrint.setState({ complete: true });
}

export function resetEncore(): void {
  if (useEncorePrint.getState().first !== null) useEncorePrint.setState({ first: null, complete: false });
}
