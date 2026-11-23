import {Quaternion,Vector3} from 'three';
import {north} from './planetTravel';
import {createShellSweep} from './orbitalSurfaces';

export const landingTurnRate=Math.PI/3.6; // at most 50°/s, zero speed at each end
export function startLandingTurn(foot:Vector3,basis:Quaternion,target:Vector3,remaining:Quaternion){
  const finish=basis.clone().premultiply(remaining).normalize(),angle=finish.angleTo(basis);
  return {start:foot.clone(),target:target.clone(),from:basis.clone(),finish,normal:north.clone().applyQuaternion(finish),
    time:0,blocked:false,duration:Math.max(.25,angle*1.5/landingTurnRate,foot.distanceTo(target)*1.6),
    // Clear a shallow ridge between a glancing contact and the final sole.
    clearance:Math.min(.18,angle*.16),sweep:createShellSweep(),foot:new Vector3(),delta:new Vector3(),q:new Quaternion(),
    eye:new Vector3(),up:new Vector3(),end:{eye:new Vector3(),up:new Vector3()}};
}
export type LandingTurn=ReturnType<typeof startLandingTurn>;

/** Feet move in after the head has begun to turn out of the opposed shell.
 * Subdivide rotation itself (not just centre translation). The same current
 * tracked pose is applied at both ends of every short sweep. Real leaning
 * is never cancelled; an obstruction pauses only the synthetic turn. */
export function stepLandingTurn(s:LandingTurn,dt:number,localEye:Vector3,foot:Vector3,basis:Quaternion){
  const time=Math.max(0,Math.min(.05,dt)),n=Math.max(1,Math.ceil(time*landingTurnRate/(Math.PI/360)));
  s.blocked=false;
  for(let i=0;i<n&&s.time<s.duration;i++){
    const next=Math.min(s.duration,s.time+time/n),t=next/s.duration,k=t*t*(3-2*t);
    s.q.slerpQuaternions(s.from,s.finish,k);s.up.copy(north).applyQuaternion(basis);s.end.up.copy(north).applyQuaternion(s.q);
    s.foot.lerpVectors(s.start,s.target,.5-.5*Math.cos(Math.PI*k)).addScaledVector(s.normal,s.clearance*Math.sin(Math.PI*k));
    s.delta.subVectors(s.foot,foot);s.eye.copy(localEye).applyQuaternion(basis);s.end.eye.copy(localEye).applyQuaternion(s.q);
    if(s.sweep(foot,s.delta,s.up,s.eye,s.end)){s.blocked=true;break;}
    foot.copy(s.foot);basis.copy(s.q);s.time=next;
  }
  return s.time===s.duration;
}
