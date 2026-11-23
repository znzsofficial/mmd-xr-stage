import {Vector3} from 'three';
import {expect,it} from 'vitest';
import {allMoons,departureAt,lanes,moonObstructed,rideStep,startRide,windPoint} from '../scenery/planet/windAtlas';
import {stationBlocks} from '../scenery/planet/opalTerrain';
import {tideCentre,tideDatum,tideFloor,tideSolid} from '../scenery/planet/tideLayout';
import {createTraveller,transport} from './planetTravel';
import {moonWalk} from './moonWalk';
import {altitude,shellRadius} from './orbitalSurfaces';
import {jumpVelocity,startOrbit,stepOrbit} from './orbitalFlight';
import {tideBodyBlocked,tideEyeLift} from './tideContact';

const lane=lanes.find(l=>l.moon.id==='tide')!,moon=lane.moon;
const floor=(x:number,z:number)=>new Vector3(tideCentre.x+x,tideDatum+tideFloor(x,z),tideCentre.z+z);

it('clears the six older lanes, their terminals and all other worlds on an off-centre departure in either direction',()=>{
  const old=lanes.filter(l=>l!==lane),others=allMoons.filter(m=>m!==moon);
  const previous=old.flatMap(l=>Array.from({length:121},(_,i)=>windPoint(l,i/120,new Vector3())));
  // None of those existing flights were moved through the new moon.
  expect(Math.min(...previous.map(p=>p.distanceTo(moon.centre)-moon.radius))).toBeGreaterThan(4);
  const p=new Vector3(),up=new Vector3();let nearestArc=Infinity,nearestWorld=Infinity,blocked=false;
  for(const returning of [false,true]){
    const port=returning?lane.away:lane.home;
    for(const sign of [-1,1]){
      const start=port.foot.clone().addScaledVector(new Vector3(1,0,0).projectOnPlane(port.up).normalize(),sign*.86);
      expect(departureAt(start,returning?moon:null)).toBe(lane);
      const ride=startRide(lane,returning,start);
      do{rideStep(ride,.05,p,up);
        for(const q of previous)nearestArc=Math.min(nearestArc,p.distanceToSquared(q));
        for(const m of others)nearestWorld=Math.min(nearestWorld,p.distanceTo(m.centre)-m.radius);
        blocked ||= stationBlocks(p,.19,1.8)||moonObstructed(moon,p,.19,1.8);
      }while(ride.time<lane.duration);
      expect(departureAt(p,returning?null:moon)).toBe(lane);
    }
  }
  expect(Math.sqrt(nearestArc)).toBeGreaterThan(1.9);expect(nearestWorld).toBeGreaterThan(4);expect(blocked).toBe(false);
});

it('follows the low shell steps in and the high bank out; the side wall stops the motor, not a physical lean',()=>{
  const s=createTraveller(),dt=1/48,dir=new Vector3();s.foot.copy(lane.away.foot);transport(s,tideCentre);
  function reach(x:number,z:number){const target=floor(x,z);
    for(let i=0;i<240&&s.foot.distanceTo(target)>.060;i++){
      dir.subVectors(target,s.foot).projectOnPlane(s.up).normalize();moonWalk(moon,s,dir,2.4,dt,false,shellRadius);
    }
    expect(s.foot.distanceTo(target),`floor at ${x},${z}`).toBeLessThan(.062);
    expect(Math.abs(s.foot.y-floor(s.foot.x-tideCentre.x,s.foot.z-tideCentre.z).y)).toBeLessThan(.001);
  }
  reach(1.05,0);reach(3.02,0);expect(s.foot.y).toBeLessThan(tideDatum-.49);reach(5.5,0);
  reach(5.2,1.45);reach(3.0,1.45);expect(s.foot.y).toBeGreaterThan(tideDatum+.10);
  // At high speed the body must not jump over the edge of the arch.
  for(let i=0;i<16;i++)moonWalk(moon,s,dir.set(0,0,1).projectOnPlane(s.up).normalize(),8,.05,false,shellRadius);
  expect(s.foot.z-tideCentre.z).toBeLessThan(2.5);
  const sole=s.foot.clone(),realEye=s.up.clone().multiplyScalar(1.65).add(new Vector3(0,0,1.0));
  expect(tideBodyBlocked(s.foot,s.up,realEye)).toBe(true);
  moonWalk(moon,s,dir.set(0,0,0),0,.05,false,shellRadius,realEye);expect(s.foot.equals(sole)).toBe(true);
  reach(3,1.45);reach(1,1.45);reach(0,0);expect(departureAt(s.foot,moon)).toBe(lane);
});

it('supports a full circuit outside the cave, including the antipode, without replacing the moon with a flat room',()=>{
  const s=createTraveller(),dir=new Vector3();s.foot.copy(lane.away.foot);transport(s,tideCentre);
  let low=1,worst=0,finished=false;
  for(let i=0;i<1500;i++){
    dir.set(0,0,1).applyQuaternion(s.basis);moonWalk(moon,s,dir,2.4,1/48,false,shellRadius);
    low=Math.min(low,s.up.y);worst=Math.max(worst,Math.abs(altitude(moon,s.foot)));
    if(low<-.999&&s.foot.distanceTo(lane.away.foot)<.12){finished=true;break;}
  }
  expect(finished).toBe(true);expect(worst).toBeLessThan(.0001);
});

it('arrests both the ordinary orbital hop and the screen hop under the side of the arch, then lands back on the floor',()=>{
  const foot=floor(3.1,1.50),up=foot.clone().sub(tideCentre).normalize(),side=new Vector3(.06,0,.10).projectOnPlane(up);
  // Stand just below the sloping soffit, including a real tracked offset.
  let height=1.10;const eye=new Vector3();
  while(height<4&&!tideBodyBlocked(foot,up,eye.copy(side).addScaledVector(up,height+.15)))height+=.02;
  eye.copy(side).addScaledVector(up,height);expect(tideBodyBlocked(foot,up,eye)).toBe(false);
  expect(tideEyeLift(foot,up,eye,.65)).toBeLessThan(.25);
  const still=new Vector3(),f=startOrbit(moon,foot,jumpVelocity(moon,up,still,2.4,new Vector3()));
  const s=createTraveller();s.foot.copy(foot);transport(s,tideCentre);let orbitPeak=0,screenPeak=0;
  for(let i=0;i<240;i++){
    if(!f.landing){stepOrbit(f,1/72,up,eye);orbitPeak=Math.max(orbitPeak,altitude(moon,f.foot));}
    moonWalk(moon,s,still,0,1/72,i===0,shellRadius,eye,up);screenPeak=Math.max(screenPeak,altitude(moon,s.foot));
    const head=f.foot.clone().add(eye);expect(tideSolid(head,.10,.095)).toBe(false);
  }
  expect(f.landing).toBe(moon);expect(s.grounded).toBe(true);
  for(const peak of [orbitPeak,screenPeak]){expect(peak).toBeGreaterThan(.03);expect(peak).toBeLessThan(.24);}
});
