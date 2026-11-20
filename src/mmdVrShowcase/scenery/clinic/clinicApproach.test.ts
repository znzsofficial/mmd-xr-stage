import {expect,it} from 'vitest';
import {canPlaceInScenery} from '../placementAreas';
import {BEDS,CANOPY_POSTS,CLINIC_ORIGIN,GLAZING,GUIDE,GARDEN_DOOR,WALK_POINTS,canWalkByLawnClinic,lawnClinicPlacementVisible} from './clinicApproach';
import {canWalkInClinic,clinicPlacementVisible,moveInClinic} from './clinicLayout';

const {x:ox,z:oz}=CLINIC_ORIGIN,lawn=(x:number,z:number)=>canPlaceInScenery('lawn',ox+x,oz+z);
it('rounds the fence end, clears the garden beds and enters the east waiting bay between its seat rows',()=>{
  const route=[...WALK_POINTS,[GARDEN_DOOR.inGate,GARDEN_DOOR.z]];
  for(let i=1;i<route.length;i++){
    const [ax,az]=route[i-1],[bx,bz]=route[i];for(let k=0;k<=30;k++)expect(lawn(ax+(bx-ax)*k/30,az+(bz-az)*k/30)).toBe(true);
  }
  for(const r of [...BEDS,...CANOPY_POSTS,...GLAZING,GUIDE]){expect(lawn(r.x,r.z)).toBe(false);expect(canWalkByLawnClinic(ox+r.x,oz+r.z)).toBe(false);}
  expect(moveInClinic(11.2,2.82,-11,0)).toMatchObject({x:expect.closeTo(.2,3),z:2.82});
  expect(canWalkInClinic(0,4.8)).toBe(false); // old opening is a solid south wall
});
it('admits a real placement sightline between the parked glass leaves but not through glass, the pier or old wall',()=>{
  const g=GLAZING[0],pier=CANOPY_POSTS[0];
  for(const [z,allowed] of [[2.8,true],[g.z,false]] as const){
    expect(clinicPlacementVisible({x:7.8,y:1.59,z},9.6,z)).toBe(allowed);
  }
  expect(clinicPlacementVisible({x:10.3,y:1.60,z:pier.z},11.9,pier.z)).toBe(false);
  expect(lawnClinicPlacementVisible({x:ox+10.3,y:1.60,z:oz+pier.z},ox+11.9,oz+pier.z)).toBe(false);
  expect(clinicPlacementVisible({x:0,y:1.60,z:3.1},0,6.12)).toBe(false);
});
