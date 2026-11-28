import {expect,it} from 'vitest';
import {BEDS,CANOPY_POSTS,GLAZING} from './clinicApproach';
import {canWalkInClinic,clinicPlacementVisible,moveInClinic} from './clinicLayout';

it('enters the east waiting bay between its seat rows while excluding planters, posts and glazing',()=>{
  for(const r of [...BEDS,...CANOPY_POSTS,...GLAZING])expect(canWalkInClinic(r.x,r.z)).toBe(false);
  expect(moveInClinic(11.2,2.82,-11,0)).toMatchObject({x:expect.closeTo(.2,3),z:2.82});
  expect(canWalkInClinic(0,4.8)).toBe(false); // old opening is a solid south wall
});
it('admits a real placement sightline between the parked glass leaves but not through glass, the pier or old wall',()=>{
  const g=GLAZING[0],pier=CANOPY_POSTS[0];
  for(const [z,allowed] of [[2.8,true],[g.z,false]] as const){
    expect(clinicPlacementVisible({x:7.8,y:1.59,z},9.6,z)).toBe(allowed);
  }
  expect(clinicPlacementVisible({x:10.3,y:1.60,z:pier.z},11.9,pier.z)).toBe(false);
  expect(clinicPlacementVisible({x:0,y:1.60,z:3.1},0,6.12)).toBe(false);
});
