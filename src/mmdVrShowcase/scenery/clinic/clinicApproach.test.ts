import {expect,it} from 'vitest';
import {RoomGate,roomLinks} from '../connections';
import {canPlaceInScenery} from '../placementAreas';
import {BEDS,CANOPY_POSTS,CLINIC_ORIGIN,GLAZING,GUIDE,SOUTH_DOOR,WALK_POINTS,canWalkByLawnClinic,moveByLawnClinic,lawnClinicPlacementVisible} from './clinicApproach';
import {canWalkInClinic,clinicPlacementVisible,DOORS,moveInClinic} from './clinicLayout';

const {x:ox,z:oz}=CLINIC_ORIGIN,lawn=(x:number,z:number)=>canPlaceInScenery('lawn',ox+x,oz+z);
it('follows the whole flower fork without intersecting fence, furniture, hills or piers, then walks through the clinic south wall',()=>{
  for(let i=1;i<WALK_POINTS.length;i++){
    const [ax,az]=WALK_POINTS[i-1],[bx,bz]=WALK_POINTS[i];
    for(let k=0;k<=20;k++)expect(lawn(ax+(bx-ax)*k/20,az+(bz-az)*k/20)).toBe(true);
  }
  for(let z=9;z>=SOUTH_DOOR.inGate;z-=.1)expect(lawn(0,z)).toBe(true);
  for(const {x,z} of [...BEDS,...CANOPY_POSTS,...GLAZING,GUIDE]){expect(lawn(x,z)).toBe(false);expect(canWalkByLawnClinic(ox+x,oz+z)).toBe(false);}
  expect(lawn(0,-1)).toBe(false);
  expect(moveByLawnClinic(ox+1.8,oz+7,0,-4).z).toBeGreaterThan(oz+4.8);
  for(const z of [3,4.71,4.83,5.2,7.12,9.75])for(const x of [-.80,.80]){
    expect(canWalkInClinic(x,z)).toBe(true);expect(canPlaceInScenery('clinic',x,z)).toBe(true);
  }
  expect(moveInClinic(0,2.5,0,6.36).z).toBeCloseTo(8.86,4);
  for(const r of [...CANOPY_POSTS,...GLAZING])expect(canPlaceInScenery('clinic',r.x,r.z)).toBe(false);
});
it('rejects the same glass and pillar sight lines on both sides, and sees a full-body floor mark from the hall',()=>{
  const from={x:0,y:1.58,z:2.48};
  expect(clinicPlacementVisible(from,-.68,8.18)).toBe(true);
  expect(clinicPlacementVisible({...from,x:1.72},1.72,7.4)).toBe(false);
  for(const x of [0,CANOPY_POSTS[0].x]){
    const allowed=x===0;
    expect(clinicPlacementVisible({x,y:1.6,z:9.86},x,7.56)).toBe(allowed);
    expect(lawnClinicPlacementVisible({x:ox+x,y:1.6,z:oz+9.86},ox+x,oz+7.56)).toBe(allowed);
  }
});
it('crosses in both directions without bouncing, ignores the glazed side and keeps all three inner doors on one scene lifetime',()=>{
  const gate=new RoomGate();
  gate.next('lawn',ox,oz+5.2);const inbound=gate.next('lawn',ox,oz+4.42)!;
  expect(inbound.to).toBe('clinic');const [dx,dz]=inbound.offset;
  expect(gate.next('clinic',ox+dx,oz+4.42+dz)).toBeNull();expect(gate.next('clinic',0,4.70)).toBeNull();
  expect(gate.next('clinic',0,5.30)?.to).toBe('lawn');expect(gate.next('lawn',ox,oz+5.30)).toBeNull();
  gate.reset();gate.next('clinic',1.82,4.31);expect(gate.next('clinic',1.28,5.28)).toBeNull();
  for(const door of Object.values(DOORS)){gate.next('clinic',door.x-.45,door.z);expect(gate.next('clinic',door.x+.45,door.z)).toBeNull();}
  for(const link of roomLinks.filter(l=>l.to==='clinic'||l.from==='clinic')){
    const [x,,z]=link.arrival.eye;expect(canPlaceInScenery(link.to,x,z)).toBe(true);
  }
});
