import {DoubleSide,Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {expect,it} from 'vitest';
import {allMoons,amberMoon,departureAt,lanes,moonObstructed,rideStep,startRide,windPoint} from './windAtlas';
import {leapAt,leapRoutes} from './leapAtlas';
import {moonRadius,moonShell} from './moonSurface';
import {terrainAltitude,stationBlocks} from './opalTerrain';
import {createTraveller} from '../../movement/planetTravel';
import {moonWalk} from '../../movement/moonWalk';
import {planetSight} from './planetSightline';

it('keeps the sixth collar clear of all five flight paths, and connects its west footprint only to Amber',()=>{
  const lane=lanes.find(l=>l.moon.id==='lantern')!,m=lane.moon;
  expect(lanes).toHaveLength(6);expect(allMoons).toHaveLength(9);
  const outward=leapRoutes.find(l=>l.pad.moon===m)!,inward=leapAt(amberMoon,outward.target.foot)!;
  expect(outward.target.moon).toBe(amberMoon);expect(inward.target.moon).toBe(m);
  expect(outward.pad.up.toArray()).toEqual([-1,0,0]);expect(inward.pad.up.x).toBe(1);
  expect(outward.pad.foot.distanceTo(outward.target.foot)).toBeCloseTo(7.2,5);
  expect(leapAt(m,lane.away.foot)).toBeUndefined();expect(departureAt(inward.pad.foot,amberMoon)).toBeUndefined();
  const routes=lanes.filter(l=>l!==lane).flatMap(l=>Array.from({length:97},(_,i)=>windPoint(l,i/96,new Vector3())));
  const p=new Vector3(),u=new Vector3();let nearest=Infinity;
  // The widest ribbons are at the ends. Off-centre departures can start up to
  // .90 m from the collar; also check the path from an off-centre return foot.
  for(const back of [false,true]){
    const port=back?lane.away:lane.home,start=port.foot.clone().addScaledVector(new Vector3().crossVectors(port.up,new Vector3(0,0,1)).normalize(),.65);
    const ride=startRide(lane,back,start);
    do{rideStep(ride,.05,p,u);for(const other of routes)nearest=Math.min(nearest,p.distanceToSquared(other));
      expect(stationBlocks(p,.22,1.8)).toBe(false);expect(moonObstructed(m,p,.22,1.8)).toBe(false);
    }while(ride.time<lane.duration);
    expect(departureAt(p,back?null:m)).toBe(lane);
  }
  expect(Math.sqrt(nearest)).toBeGreaterThan(1.9);
});

it.each(lanes)('carries an off-centre foot clear of both surfaces and back without ending inside a launch prop',lane=>{
  const p=new Vector3(),up=new Vector3(),start=lane.home.foot.clone().addScaledVector(lane.home.up,.09);
  expect(departureAt(new Vector3(0,0,1.90),null)).toBeUndefined();expect(departureAt(start,null)).toBe(lane);
  const ride=startRide(lane,false,start);rideStep(ride,0,p,up);expect(p.distanceTo(start)).toBeLessThan(1e-7);
  for(let i=1;i<100;i++){
    windPoint(lane,i/100,p);expect(terrainAltitude(p)).toBeGreaterThan(.01);expect(stationBlocks(p,.23,1.82)).toBe(false);
    for(const m of allMoons){const n=p.clone().sub(m.centre),r=n.length();n.normalize();expect(r-moonRadius(m,n.x,n.y,n.z)).toBeGreaterThan(.001);}
  }
  while(!rideStep(ride,1/72,p,up)){}expect(p.distanceTo(lane.away.foot)).toBeLessThan(1e-7);expect(up.toArray()).toEqual([0,1,0]);
  const back=startRide(lane,true,p);while(!rideStep(back,1/90,p,up)){}expect(p.distanceTo(lane.home.foot)).toBeLessThan(1e-7);
  expect(departureAt(lane.away.foot, lane.moon)).toBe(lane);
});
it.each(allMoons)('$id supports an antipodal walk and radial jump on the actual rendered satellite',m=>{
  const s=createTraveller(),d=new Vector3(),g=moonShell(m),mat=new MeshBasicMaterial({side:DoubleSide}),mesh=new Mesh(g,mat),ray=new Raycaster();
  s.foot.copy(m.centre).y+=moonRadius(m,0,1,0);let lo=1,high=0,error=0;
  try{for(let i=0;i<1800;i++){
    d.set(0,0,1).applyQuaternion(s.basis);moonWalk(m,s,d,2.4,1/90,i===50);lo=Math.min(lo,s.up.y);
    const radial=s.foot.distanceTo(m.centre),surface=moonRadius(m,s.up.x,s.up.y,s.up.z);high=Math.max(high,radial-surface);
    if(i%48===0){ray.ray.origin.copy(s.up).multiplyScalar(8);ray.ray.direction.copy(s.up).negate();const hit=ray.intersectObject(mesh)[0];error=Math.max(error,Math.abs(surface-hit.point.length()));}
   }expect(lo).toBeLessThan(-.99);expect(high).toBeGreaterThan(.30);expect(error).toBeLessThan(.065);expect(s.grounded).toBe(true);}finally{g.dispose();mat.dispose();}
  const eye=m.centre.clone().multiplyScalar(1.6);expect(planetSight(eye,0,0,0)).toBe(false);
});
