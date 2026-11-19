import { afterEach, describe, expect, it, vi } from 'vitest';
import { Vector3 } from 'three';
import { canPlaceInScenery } from '../../scenery/placementAreas';
import { useStagePlay } from '../stagePlay';
import { aimEncore, BADGE_RADIUS, BADGE_X, BADGE_Y, BADGE_Z, dyeEncore, resetEncore, useEncorePrint } from './encoreRound';

afterEach(() => { resetEncore(); useStagePlay.getState().reset(); });

describe('encore dye station', () => {
  it.each(['left', 'right'] as const)('aims an oblique world ray at the %s badge on an existing blocked footprint', side => {
    const x = side === 'left' ? -BADGE_X : BADGE_X;
    const origin = new Vector3(.8, 1.64, 3), target = new Vector3(x + .96 * BADGE_RADIUS, BADGE_Y, BADGE_Z);
    const unscaled = target.clone().sub(origin);
    for (const length of [.1, 1, 4.7]) expect(aimEncore(origin, unscaled.clone().multiplyScalar(length))).toBe(side);
    expect(aimEncore(origin, new Vector3(x, BADGE_Y + BADGE_RADIUS + .01, BADGE_Z).sub(origin))).toBeNull();
    for (const offset of [-BADGE_RADIUS,0,BADGE_RADIUS]) expect(canPlaceInScenery('liveHouse', x + offset, BADGE_Z)).toBe(false);
  });

  it('ignores the centre, back of the cabinet, parallel ray and out-of-range origin', () => {
    const target = new Vector3(BADGE_X, BADGE_Y, BADGE_Z);
    expect(aimEncore(new Vector3(0, 1.6, 2), new Vector3(0, 0, -1))).toBeNull();
    expect(aimEncore(target.clone().add(new Vector3(0,0,-1)), new Vector3(0,0,1))).toBeNull();
    expect(aimEncore(target, new Vector3(1,0,0))).toBeNull();
    expect(aimEncore(target.clone().add(new Vector3(0,0,19)), new Vector3(0,0,-4))).toBeNull();
  });

  it.each(['left', 'right'] as const)('locks the %s-first print, accepts two distinct taps, and survives prop transfer', first => {
    const other = first === 'left' ? 'right' : 'left', changed = vi.fn();
    const stop = useEncorePrint.subscribe(changed), play = useStagePlay.getState();
    try {
      play.equip('encore','right'); dyeEncore(first); dyeEncore(first);
      expect(useEncorePrint.getState()).toEqual({ first, complete: false });
      dyeEncore(other); play.give('singer','left'); play.give('singer','right'); play.stow();
      for (let i=0;i<100;i++) dyeEncore(i%2 ? first : other);
      expect(useEncorePrint.getState()).toEqual({ first, complete: true });
      expect(changed).toHaveBeenCalledTimes(2);
      resetEncore(); dyeEncore(other);
      expect(useEncorePrint.getState()).toEqual({ first: other, complete: false });
    } finally { stop(); }
  });
});
