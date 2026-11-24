import {Quaternion,Vector3} from 'three';
import type {Orbit} from './orbitalFlight';
import {shellRadius,type World} from './orbitalSurfaces';
import {carryFrame,type Traveller} from './planetTravel';

const sole=new Vector3(),delta=new Vector3(),inverse=new Quaternion();
type Stance=Traveller&{offset:Vector3;seat:Vector3;display:Quaternion;viewUp:Vector3;groundTilt:Quaternion};

/** Ground navigation owns the true contact point immediately. Express the
 * existing XR frame about that support, without rotating the displayed eyes. */
export function seatOrbitContact(s:Stance,f:Orbit,world:World,p:{x:number;z:number},worldEye:Vector3,height:number){
  sole.copy(worldEye).addScaledVector(s.viewUp,-height).add(f.foot);
  if(f.tracked&&f.part==='body'&&s.viewUp.dot(f.up)>.5&&Math.abs(delta.subVectors(sole,f.point).dot(f.up))<.05){
    // A rounded ankle can beat a feet-first landing by a few millimetres.
    // Seat the sole under the tracked foot, not under the ankle.
    f.up.subVectors(sole,world.centre).normalize();
    f.point.copy(world.centre).addScaledVector(f.up,shellRadius(world,f.up.x,f.up.y,f.up.z));
    s.seat.set(0,0,0);s.offset.set(p.x,0,p.z);
  }else if(f.part==='foot'&&(f.tracked||s.seat.lengthSq()<1e-8)){
    s.seat.set(0,0,0);if(f.tracked)s.offset.set(p.x,0,p.z);
  }else{
    // Head or side first: planting a nominal XR sole here would move the
    // physical eyes into rock. Keep the swept pose until an explicit Y.
    s.seat.add(delta.subVectors(f.foot,f.point).applyQuaternion(inverse.copy(s.display).invert()));
    if(f.tracked){s.seat.x+=p.x-s.offset.x;s.seat.z+=p.z-s.offset.z;s.offset.set(p.x,0,p.z);}
  }
  if(s.up.dot(f.up)<-.999999){ // Choose the navigation heading as the axis at an exact antipode.
    delta.set(0,0,-1).applyQuaternion(s.basis);s.basis.premultiply(s.arc.setFromAxisAngle(delta,Math.PI));s.up.negate();}
  carryFrame(s,f.up);s.groundTilt.copy(s.basis).invert().multiply(s.display).normalize();
  s.foot.copy(f.point);s.velocity.set(0,0,0);s.grounded=true;
}
