import type {Vector3} from 'three';
import {moonObstructed,moonRadius,type Moon} from '../scenery/planet/windAtlas';
import {transport,type Traveller} from './planetTravel';

/** The small moons have no imported actors or structures above the surface.
 * Keep the optional Ecctrl world parked on the mother planet. */
export function moonWalk(m:Moon,s:Traveller,travel:Vector3,speed:number,dt:number,jump:boolean){
  const p=s.destination.copy(s.foot).addScaledVector(travel,speed*dt);
  if(moonObstructed(m,p,.19,1.74))p.copy(s.foot);
  const r=s.foot.distanceTo(m.centre),n=s.radial.subVectors(p,m.centre).normalize();
  const surface=moonRadius(m,n.x,n.y,n.z),v=jump&&s.grounded?1.36:s.velocity.dot(s.up);
  // Walk contours (including downhill) while planted. Only a deliberate
  // jump enters the ballistic branch; poles and crater rims share one rule.
  const height=s.grounded&&!jump?surface:r+v*dt-1.25*dt*dt;
  s.grounded=height<=surface+.000001&&v-2.5*dt<=0;
  s.foot.copy(m.centre).addScaledVector(n,Math.max(surface,height));transport(s,m.centre);
  s.velocity.copy(travel).multiplyScalar(speed).projectOnPlane(s.up).addScaledVector(s.up,s.grounded?0:v-2.5*dt);
}
