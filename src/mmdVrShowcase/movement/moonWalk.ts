import type {Vector3} from 'three';
import {moonObstructed,type WalkMoon} from '../scenery/planet/windAtlas';
import {moonRadius} from '../scenery/planet/moonSurface';
import {transport,type Traveller} from './planetTravel';

export const MOON_JUMP_SPEED=1.6; // m/s; equal impulse, different heights and hang times

/** Follow local radial support and the moon's station/trunk solids. The optional
 * Ecctrl world stays parked on the mother planet throughout a lunar walk. */
export function moonWalk(m:WalkMoon,s:Traveller,travel:Vector3,speed:number,dt:number,jump:boolean,readRadius:(m:WalkMoon,x:number,y:number,z:number)=>number=moonRadius){
  const p=s.destination.copy(s.foot).addScaledVector(travel,speed*dt);
  if(moonObstructed(m,p,.19,1.74))p.copy(s.foot);
  const r=s.foot.distanceTo(m.centre),n=s.radial.subVectors(p,m.centre).normalize();
  const surface=readRadius(m,n.x,n.y,n.z),v=s.grounded?(jump?MOON_JUMP_SPEED:0):s.velocity.dot(s.up),g=m.surfaceGravity;
  // Walk contours (including downhill) while planted. Only a deliberate
  // jump enters the ballistic branch; poles and crater rims share one rule.
  const height=s.grounded&&!jump?surface:r+v*dt-.5*g*dt*dt;
  s.grounded=height<=surface+.000001&&v-g*dt<=0;
  s.foot.copy(m.centre).addScaledVector(n,Math.max(surface,height));transport(s,m.centre);
  s.velocity.copy(travel).multiplyScalar(speed).projectOnPlane(s.up).addScaledVector(s.up,s.grounded?0:v-g*dt);
}
