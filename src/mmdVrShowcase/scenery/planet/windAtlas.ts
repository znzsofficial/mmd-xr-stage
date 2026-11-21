import {Vector3} from 'three';
import {crustRadius} from './opalTerrain';
import {PLANET_RADIUS} from './planetLayout';
import {moonRadius} from './moonSurface';

export const sunDirection=new Vector3(-5,3.2,3.8).normalize();
const homeCentre=new Vector3(0,-PLANET_RADIUS,0),north=new Vector3(0,1,0);
const destinations=[
  {id:'ember',relief:'basins',instrument:'seismometer',centre:new Vector3(-15.2,4.5,-13.1),radius:4.55,surfaceGravity:2.8,color:'#f3a668',port:new Vector3(-.281,.957,-.069).normalize(),
    stationUp:new Vector3(.51,.82,-.36).normalize(),duration:8.5,launchKey:'emberWind',returnKey:'emberReturn',sign:'01 · 赭砾星',caption:'EMBER   /   IMPACT BASINS'},
  {id:'frost',relief:'rifts',instrument:'dish',centre:new Vector3(16.5,6.1,-14.5),radius:5.2,surfaceGravity:2.15,color:'#72dcf0',port:new Vector3(.281,.957,-.069).normalize(),
    stationUp:new Vector3(-.48,.82,-.36).normalize(),duration:9.5,launchKey:'frostWind',returnKey:'frostReturn',sign:'02 · 霜岬星',caption:'FROST   /   ICE RIFTS'},
  {id:'salt',relief:'salt',instrument:'prism',centre:new Vector3(-6.8,18,-25),radius:4.8,surfaceGravity:1.25,color:'#e6a7ff',port:new Vector3(-.208,.942,.263).normalize(),
    stationUp:new Vector3(.41,.77,.49).normalize(),duration:10.5,launchKey:'saltWind',returnKey:'saltReturn',sign:'03 · 棱盐星',caption:'HALITE   /   PRISM FLATS'},
  {id:'glaze',relief:'glaze',instrument:'kiln',centre:new Vector3(9.8,18,-25),radius:4.6,surfaceGravity:3.65,color:'#ff7759',port:new Vector3(.208,.942,.263).normalize(),
    stationUp:new Vector3(-.60,.73,.32).normalize(),duration:10.5,launchKey:'glazeWind',returnKey:'glazeReturn',sign:'04 · 玄釉星',caption:'OBSIDIAN   /   FURNACE GLASS'},
] as const;
export const moons=destinations.map(({stationUp:up,...m})=>({
  ...m,station:{up,base:up.clone().multiplyScalar(moonRadius(m,up.x,up.y,up.z)).add(m.centre),r:.52,h:1.40},
}));
export type Moon=typeof moons[number];
export function moonObstructed(m:Moon,p:Vector3,r:number,height:number){
  const s=m.station,x=p.x-s.base.x,y=p.y-s.base.y,z=p.z-s.base.z,a=x*s.up.x+y*s.up.y+z*s.up.z;
  return a<s.h&&a+height>-.15&&x*x+y*y+z*z-a*a<(r+s.r)**2;
}
export interface WindPort { foot:Vector3; up:Vector3 }
export const lanes=moons.map(m=>({moon:m,
  home:{up:m.port,foot:m.port.clone().multiplyScalar(crustRadius(m.port.x,m.port.y,m.port.z)).add(homeCentre)},
  away:{up:north,foot:m.centre.clone().addScaledVector(north,m.radius)},
  duration:m.duration,
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
export const launchViews=lanes.map(l=>({key:l.moon.launchKey,
  eye:l.home.foot.clone().addScaledVector(north,1.65).toArray() as P,
  aim:l.moon.centre.toArray() as P}));
export const returnViews=lanes.map(l=>({key:l.moon.returnKey,eye:l.away.foot.clone().addScaledVector(north,1.65).toArray() as P,aim:[0,-1,0] as const}));
