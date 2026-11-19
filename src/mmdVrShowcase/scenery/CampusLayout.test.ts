import {it,expect} from 'vitest';
import {CAMPUS_DOOR,CAMPUS_OFFSET} from './CampusLayout';
import {RoomGate,roomLinks,type RoomLink} from './connections';
import {canPlaceInScenery} from './placementAreas';

it('keeps a continuous floor out the rear door while rejecting the rear wall, columns and distant facade',()=>{
  for(let z=4;z<7.3;z+=.1)expect(canPlaceInScenery('classroom',CAMPUS_DOOR,z)).toBe(true);
  for(let x=CAMPUS_DOOR;x>=-8.4;x-=.11)expect(canPlaceInScenery('classroom',x,7.16)).toBe(true);
  for(const [x,z] of [[-4.88,5.62],[-2.45,6.02],[-7.22,8.42]])expect(canPlaceInScenery('classroom',x,z)).toBe(false);
  expect(canPlaceInScenery('lawn',14,-6.8)).toBe(false);
});
it('only crosses a sign in the correct direction and cannot rebound on the arrival frame',()=>{
  const gate=new RoomGate();expect(gate.next('classroom',-9,7.2)).toBeNull();
  gate.next('classroom',-8.5,7.2);expect(gate.next('classroom',-9,7.2)?.to).toBe('lawn');
  expect(gate.next('lawn',-9+CAMPUS_OFFSET.x,7.2+CAMPUS_OFFSET.z)).toBeNull();expect(gate.next('lawn',6.5,.4)?.to).toBe('classroom');
  gate.reset();gate.next('classroom',-8.4,5.3);expect(gate.next('classroom',-9,5.3)).toBeNull();
});
it('selects the right exit when a zone has two and ignores a teleport',()=>{
  const second:RoomLink={...roomLinks[1],to:'pool',axis:'z',direction:-1,gate:-6,band:[1,4]};
  const gate=new RoomGate([...roomLinks,second]);gate.next('lawn',2,3);
  expect(gate.next('lawn',2,-7)).toBeNull();gate.next('lawn',2,-5.75);
  expect(gate.next('lawn',2,-6.1)).toBe(second);
});
