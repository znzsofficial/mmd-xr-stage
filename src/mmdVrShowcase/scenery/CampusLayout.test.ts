import {it,expect} from 'vitest';
import {CAMPUS_DOOR,CAMPUS_OFFSET} from './CampusLayout';
import {RoomGate} from './connections';
import {POOL_ORIGIN_Z,GUARD_CHAIR,PACE_CLOCK,LIDO_PIERS} from './LidoLayout';
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
  const gate=new RoomGate();gate.next('lawn',0,3);expect(gate.next('lawn',0,-12)).toBeNull();
  gate.next('lawn',0,-10.96);const pool=gate.next('lawn',0,-11.42)!;
  expect(pool.to).toBe('pool');expect(gate.next('pool',0,-11.42+pool.offset[1])).toBeNull();
  expect(gate.next('pool',0,10.01)?.to).toBe('lawn');
  gate.next('lawn',5.8,.40);expect(gate.next('lawn',6.5,.40)?.to).toBe('classroom');
});
it('has a placeable route from the meadow to the pool clock without treating furniture or water as floor',()=>{
  for(let z=0;z>=-11.3;z-=.12)expect(canPlaceInScenery('lawn',0,z)).toBe(true);
  for(let z=-11.3-POOL_ORIGIN_Z;z>=0;z-=.12)expect(canPlaceInScenery('pool',0,z)).toBe(true);
  for(let z=0;z>=-20.35;z-=.12)expect(canPlaceInScenery('pool',6.05,z),`east walk z=${z}`).toBe(true);
  for(const r of [GUARD_CHAIR,PACE_CLOCK,...LIDO_PIERS])expect(canPlaceInScenery('pool',r.x,r.z)).toBe(false);
  for(const r of LIDO_PIERS)expect(canPlaceInScenery('lawn',r.x,r.z+POOL_ORIGIN_Z)).toBe(false);
  expect(canPlaceInScenery('lawn',0,-25)).toBe(false);
});
