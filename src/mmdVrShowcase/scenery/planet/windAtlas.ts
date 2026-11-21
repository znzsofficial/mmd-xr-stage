import {Vector3} from 'three';
import {crustRadius} from './opalTerrain';
import {PLANET_RADIUS} from './planetLayout';

export const sunDirection=new Vector3(-5,3.2,3.8).normalize();
const homeCentre=new Vector3(0,-PLANET_RADIUS,0),north=new Vector3(0,1,0);
export const moons=[
  {id:'ember',centre:new Vector3(-15.2,4.5,-13.1),radius:4.55,color:'#f3a668',port:new Vector3(-.281,.957,-.069).normalize()},
  {id:'frost',centre:new Vector3(16.5,6.1,-14.5),radius:5.2,color:'#72dcf0',port:new Vector3(.281,.957,-.069).normalize()},
] as const;
export type Moon=typeof moons[number];
const pits=Array.from({length:30},(_,i)=>{
  const y=1-(i+.5)/15,s=Math.sqrt(1-y*y),a=i*2.39996+.38;
  return {x:s*Math.sin(a),y,z:s*Math.cos(a),width:.007+.036*((i*13%29)/29)**2};
});
// The walking motor and actual meshes sample the same unit-vector relief.
// Taper the terrain towards the north landing so its wind collar sits flush.
export function moonRadius(m:Moon,x:number,y:number,z:number){
  const relief=(1-Math.exp(-Math.max(0,1-y)*22));
  let h=.062*Math.sin(x*9+y*6)*Math.cos(z*8-y*4);
  if(m.id==='ember'){
    for(const p of pits){const d=(1-x*p.x-y*p.y-z*p.z)/p.width;if(d>2.2)continue;
      h+=Math.sqrt(p.width)*(-1.65*Math.max(0,1-d)**1.5+.72*Math.exp(-((d-1)**2)/.070));}
  }else{
    const seam=Math.sin(4.2*x-3.6*y+1.28*Math.sin(4*z)),ridge=Math.cos(5*z+2.8*y+1.2*Math.sin(5*x));
    // Broad pressure ridges carry the foot; narrow hairline cracks are albedo
    // only. A cusp thinner than a shell triangle makes walkers float over it.
    h+=.33*Math.exp(-14*(seam+.23)**2)-.17*Math.exp(-27*seam*seam)+.18*Math.exp(-18*ridge*ridge);
  }
  return m.radius+h*relief;
}
export const moonStations=moons.map(m=>{
  const up=new Vector3(m.id==='ember'?.51:-.48,.82,-.36).normalize();
  return {moon:m,up,base:up.clone().multiplyScalar(moonRadius(m,up.x,up.y,up.z)).add(m.centre),r:.52,h:1.40};
});
export function moonObstructed(m:Moon,p:Vector3,r:number,height:number){
  const s=moonStations[m.id==='ember'?0:1],x=p.x-s.base.x,y=p.y-s.base.y,z=p.z-s.base.z,a=x*s.up.x+y*s.up.y+z*s.up.z;
  return a<s.h&&a+height>-.15&&x*x+y*y+z*z-a*a<(r+s.r)**2;
}
export interface WindPort { foot:Vector3; up:Vector3 }
export const lanes=moons.map(m=>({moon:m,
  home:{up:m.port,foot:m.port.clone().multiplyScalar(crustRadius(m.port.x,m.port.y,m.port.z)).add(homeCentre)},
  away:{up:north,foot:m.centre.clone().addScaledVector(north,m.radius)},
  duration:m.id==='ember'?8.5:9.5,
}));
export type WindLane=typeof lanes[number];
export function departureAt(foot:Vector3,world:Moon|null){
  return lanes.find(l=>(!world||world===l.moon)&&foot.distanceToSquared(world?l.away.foot:l.home.foot)<.90**2);
}
// A single geometric flightline for the wind tracers, XR foot and screen camera.
// The two control tangents point out of each local surface. Ease time separately
// so launch and touchdown both have zero speed, including on the return trip.
export function windPoint(l:WindLane,t:number,out:Vector3){
  const v=1-t,a=3*v*v*t,b=3*v*t*t;
  return out.copy(l.home.foot).multiplyScalar(v*v*v+a).addScaledVector(l.home.up,9*a)
    .addScaledVector(l.away.foot,t*t*t+b).addScaledVector(l.away.up,7*b);
}
export function startRide(lane:WindLane,returning:boolean,actual:Vector3){
  return {lane,returning,time:0,offset:actual.clone().sub((returning?lane.away:lane.home).foot)};
}
export type Ride=ReturnType<typeof startRide>;
export function rideStep(ride:Ride,dt:number,foot:Vector3,up:Vector3){
  ride.time=Math.min(ride.lane.duration,ride.time+Math.max(0,Math.min(.05,dt)));
  const f=ride.time/ride.lane.duration,k=f*f*(3-2*f),t=ride.returning?1-k:k;
  windPoint(ride.lane,t,foot).addScaledVector(ride.offset,1-k);
  up.copy(ride.lane.home.up).lerp(ride.lane.away.up,t).normalize();
  return f===1;
}

type P=[number,number,number];
export const launchViews=lanes.map(l=>({key:l.moon.id==='ember'?'emberWind' as const:'frostWind' as const,
  eye:l.home.foot.clone().addScaledVector(north,1.65).toArray() as P,
  aim:l.moon.centre.toArray() as P}));
