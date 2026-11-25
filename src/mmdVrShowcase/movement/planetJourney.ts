import type {Group,Quaternion,Vector3} from 'three';
import type {Ride} from '../scenery/planet/windAtlas';
import type {Orbit} from './orbitalFlight';
import {seatOrbitContact} from './orbitContact';
import {homeWorld,type World} from './orbitalSurfaces';
import {north,type Traveller} from './planetTravel';
import type {TwinLeap} from './twinLeap';

export type Landing = 'upright'|'protected';
export type Ground = {kind:'ground';world:World;landing:Landing};
export type PlanetMode = Ground | {kind:'free';world:World} | {kind:'wind';ride:Ride}
  | {kind:'twinLeap';leap:TwinLeap;landing:Landing} | {kind:'orbit';flight:Orbit;landing:Landing};
export const ground=(world:World=homeWorld,landing:Landing='upright'):Ground=>({kind:'ground',world,landing});

export function viewWorld(mode:PlanetMode):World {
  switch(mode.kind){
    case 'free':case 'ground':return mode.world;
    case 'wind':return mode.ride.returning?mode.ride.lane.moon:homeWorld;
    case 'twinLeap':return mode.leap.owner;
    case 'orbit':return mode.flight.owner??mode.flight.from;
  }
}

type View=Traveller&{seat:Vector3;offset:Vector3;display:Quaternion;viewUp:Vector3;groundTilt:Quaternion};
export function landOrbit(s:View,mode:Extract<PlanetMode,{kind:'orbit'}>,world:World,p:{x:number;z:number},eye:Vector3,height:number):Ground {
  const f=mode.flight,feetFirst=seatOrbitContact(s,f,world,p,eye,height);
  // Decide from the actual contact, not equality of two floating point attitudes.
  return ground(world, mode.landing==='protected'||!feetFirst||f.changes>0||world!==f.from?'protected':'upright');
}

// The room-scale head pose is a child of this origin. Never replace it with
// the motor's stance, even when the drawn horizon differs from navigation up.
export function publishPlanetView(origin:Group,s:View,lift:number){
  origin.quaternion.multiplyQuaternions(s.basis,s.groundTilt);
  origin.position.subVectors(s.seat,s.offset).applyQuaternion(origin.quaternion).add(s.foot);
  origin.position.addScaledVector(s.viewUp.copy(north).applyQuaternion(origin.quaternion),lift);
  origin.updateMatrixWorld(true);
}
