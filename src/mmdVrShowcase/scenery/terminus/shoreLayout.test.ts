import {expect,it} from 'vitest';
import {roomGround} from '../../movement/roomGround';
import {roomPickDecks,resolvePlacementHeight,visiblePick} from '../placementAreas';
import {createTideClock} from './tideClock';
import {bindStationTide,shoreWalkingPace} from './stationTide';
const room='seasideTerminus' as const;
it('keeps the connected lower landing walkable at both tides and the dry beacon apron placeable',()=>{
  const scene={},clock=createTideClock(),remove=bindStationTide(scene,clock);
  for(const x of [1.8,14.1]){let y=0;for(let z=-13;z>=-17;z-=.075){const next=roomGround(room,x,z);expect(Math.abs(next-y)).toBeLessThan(.16);y=next;}expect(y).toBe(-.48);}
  expect(shoreWalkingPace(scene,-.48)).toBe(1);clock.turn();for(let i=0;i<320;i++)clock.step(1/60);
  expect(shoreWalkingPace(scene,-.48)).toBeLessThan(.7);expect(shoreWalkingPace(scene,0)).toBe(1);remove();
  for(const [x,z] of [[0,0],[1,-4],[12,-11.65]]){expect(resolvePlacementHeight(room,x,z,0)).toBe(0);expect(roomPickDecks(room).some(d=>Math.abs(d.x-x)<=d.w/2&&Math.abs(d.z-z)<=d.d/2)).toBe(true);}
  for(const [x,z] of [[1.97,-3.62],[1.84,1.45],[8,-17],[-6,-2],[15.9,-11.78],[2,-15]])expect(resolvePlacementHeight(room,x,z)).toBeNull();
  expect(visiblePick(room,{x:9,y:1.56,z:-11.66},12,0,-11.65)).toBe(true);
  expect(visiblePick(room,{x:-.25,y:1.55,z:1.45},2.65,0,1.45)).toBe(false);
});
