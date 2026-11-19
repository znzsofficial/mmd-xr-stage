import {it,expect} from 'vitest';
import {CAMPUS_DOOR,CAMPUS_OFFSET,CampusGate} from './CampusLayout';
import {canPlaceInScenery} from './placementAreas';

it('keeps a continuous floor out the rear door while rejecting the rear wall, columns and distant facade',()=>{
  for(let z=4;z<7.3;z+=.1)expect(canPlaceInScenery('classroom',CAMPUS_DOOR,z)).toBe(true);
  for(let x=CAMPUS_DOOR;x>=-8.4;x-=.11)expect(canPlaceInScenery('classroom',x,7.16)).toBe(true);
  for(const [x,z] of [[-4.88,5.62],[-2.45,6.02],[-7.22,8.42]])expect(canPlaceInScenery('classroom',x,z)).toBe(false);
  expect(canPlaceInScenery('lawn',14,-6.8)).toBe(false);
});
it('only crosses a sign in the correct direction and cannot rebound on the arrival frame',()=>{
  const gate=new CampusGate();expect(gate.next('classroom',-9,7.2)).toBe(false);
  gate.next('classroom',-8.5,7.2);expect(gate.next('classroom',-9,7.2)).toBe(true);
  expect(gate.next('lawn',-9+CAMPUS_OFFSET.x,7.2+CAMPUS_OFFSET.z)).toBe(false);expect(gate.next('lawn',6.5,.4)).toBe(true);
  gate.reset();gate.next('classroom',-8.4,5.3);expect(gate.next('classroom',-9,5.3)).toBe(false);
});
