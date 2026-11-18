import { describe, expect, it } from 'vitest';
import { sceneryIds } from './catalog';
import { canPlaceInScenery, LAWN_KNOLLS, LAWN_TREES } from './placementAreas';
import { CLASS_FIXTURES, ROOM } from './ClassroomLayout';

describe('placeable ground at foot height', () => {
  it.each(sceneryIds)('has a usable origin and rejects invalid space in %s', id => {
    expect(canPlaceInScenery(id,0,0)).toBe(true);
    for(const [x,z] of [[NaN,0],[0,Infinity],[100,100]]) expect(canPlaceInScenery(id,x,z)).toBe(false);
  });
  it('leaves a continuous centre aisle and a window lane; the teaching and student furniture remains occupied', () => {
    for(let z=-4.8;z<4.7;z+=.15) for(const x of [-4.55,-1.15,0,1.15]) expect(canPlaceInScenery('classroom',x,z)).toBe(true);
    for(const f of CLASS_FIXTURES) expect(canPlaceInScenery('classroom',f.x,f.z)).toBe(false);
    expect(canPlaceInScenery('classroom',-ROOM.w/2+.06,0)).toBe(false);
    expect(canPlaceInScenery('classroom',0,-ROOM.d/2+.06)).toBe(false);
    expect(canPlaceInScenery('classroom',-.70,-ROOM.d/2+.285)).toBe(false);
  });
  it('distinguishes the pool surround, water, ladder, starting blocks and lower ground beyond the terrace', () => {
    for(const [x,z] of [[0,-12],[4.94,-6],[0,-18.87],[-4.34,-5.47],[-1.65,-19.42],[7.13,-12.6],[9,-12],[12,0]])
      expect(canPlaceInScenery('pool',x,z),`blocked ${x},${z}`).toBe(false);
    for(const [x,z] of [[0,-5.42],[6,-12],[-6,-5.71],[.2,-19.56],[9,0]])
      expect(canPlaceInScenery('pool',x,z),`deck ${x},${z}`).toBe(true);
  });
  it('uses the round simple deck and excludes the backline of the live stage', () => {
    expect(canPlaceInScenery('floor',7,0)).toBe(true);
    expect(canPlaceInScenery('floor',6,6)).toBe(false);
    for(const [x,z] of [[4.55,-3.88],[-4.55,-3.88],[0,-5.32],[5.13,-4.49],[6,0]]) expect(canPlaceInScenery('liveHouse',x,z)).toBe(false);
    expect(canPlaceInScenery('liveHouse',2,-4.65)).toBe(true);
    expect(canPlaceInScenery('liveHouse',-3.3,-3.62)).toBe(true);
  });
  it('rejects the raised parts of the meadow while preserving the grassy clearing', () => {
    for(const f of [...LAWN_TREES,...LAWN_KNOLLS]) expect(canPlaceInScenery('lawn',f.x,f.z)).toBe(false);
    for(const [x,z] of [[3,-2],[-2.5,3],[0,-3.5]]) expect(canPlaceInScenery('lawn',x,z)).toBe(true);
  });
});
