import {Quaternion,Vector3} from 'three';
import {createShellSweep} from './orbitalSurfaces';
import {north} from './planetTravel';

export const landingTurnRate=Math.PI/3.6; // maximum angular speed, 50°/s

/** The navigation sole already belongs to the destination. This second pose
 * is only the displayed XR floor while the visitor rises from a body/head hit.
 * The destination is read again each frame, including while walking away. */
export function standingArrival(foot:Vector3,basis:Quaternion){return {
  foot:foot.clone(),basis:basis.clone(),rate:0,blocked:false,sweep:createShellSweep(),q:new Quaternion(),goal:new Vector3(),delta:new Vector3(),
  eye:new Vector3(),up:new Vector3(),normal:new Vector3(),escape:new Vector3(),sole:new Vector3(),end:{eye:new Vector3(),up:new Vector3()},
};}
export type StandingArrival=ReturnType<typeof standingArrival>;

export function riseToFeet(s:StandingArrival,dt:number,localEye:Vector3,target:Vector3,targetBasis:Quaternion){
  const time=Math.min(.05,Math.max(0,dt)),count=Math.max(1,Math.ceil(time*120)),h=time/count;
  s.normal.copy(north).applyQuaternion(targetBasis);s.blocked=false;
  for(let i=0;i<count;i++){
    s.up.copy(north).applyQuaternion(s.basis);s.eye.copy(localEye).applyQuaternion(s.basis);
    const angle=s.basis.angleTo(targetBasis);s.rate=Math.min(landingTurnRate,s.rate+2.2*h,Math.sqrt(4.4*angle));
    s.q.copy(s.basis).rotateTowards(targetBasis,s.rate*h);
    s.end.up.copy(north).applyQuaternion(s.q);s.end.eye.copy(localEye).applyQuaternion(s.q);
    // Keep the entire tilted body on the outer side of the contact plane.
    // As the head turns out, the displayed soles can approach the real floor.
    s.sole.copy(s.end.eye).addScaledVector(s.end.up,.15-localEye.y);
    const lift=Math.max(0,.15-s.sole.dot(s.normal),.115-s.end.eye.dot(s.normal));
    s.goal.copy(target).addScaledVector(s.normal,lift);
    s.delta.subVectors(s.goal,s.foot).clampLength(0,2.4*h);
    const hit=s.sweep(s.foot,s.delta,s.up,s.eye,s.end);
    if(!hit){s.foot.add(s.delta);s.basis.copy(s.q);}
    else {
      // A slope may rise above its radial tangent plane. Don't keep trying
      // the same blocked screw motion: retreat from the measured contact
      // before rotating. The retreat is swept too, even between two shells.
      s.escape.copy(hit.up).multiplyScalar(1.6*h);
      if(!s.sweep(s.foot,s.escape,s.up,s.eye))s.foot.add(s.escape);
      else {s.blocked=true;break;}
    }
  }
  return s.basis.angleTo(targetBasis)<1e-6&&s.foot.distanceToSquared(target)<1e-10;
}
