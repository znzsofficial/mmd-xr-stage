import {Quaternion,Vector3} from 'three';
import {moonObstructed,type WalkMoon} from '../scenery/planet/windAtlas';
import {moonRadius} from '../scenery/planet/moonSurface';
import {transport,type Traveller} from './planetTravel';
import {tideBodyBlocked} from './tideContact';

export const MOON_JUMP_SPEED=1.6; // m/s; equal impulse, different heights and hang times

const rotation=new Quaternion(),nextUp=new Vector3(),nextEye=new Vector3(),nominalEye=new Vector3();
type Radius=(m:WalkMoon,x:number,y:number,z:number)=>number;
// The cavern has two layers at the same XZ: floor is radial support, the
// arch and its springing walls are obstructions, never a taller floor.
function tideStep(m:WalkMoon,s:Traveller,travel:Vector3,speed:number,dt:number,jump:boolean,readRadius:Radius,eye:Vector3,viewUp:Vector3){
  const from=s.foot,r=from.distanceTo(m.centre),v=s.grounded?(jump?MOON_JUMP_SPEED:0):s.velocity.dot(s.up);
  let vy=v-m.surfaceGravity*dt;
  const freeRadius=r+v*dt-.5*m.surfaceGravity*dt*dt,p=s.destination,n=s.radial;
  function candidate(move:boolean){
    p.copy(from);if(move)p.addScaledVector(travel,speed*dt);
    n.subVectors(p,m.centre).normalize();const floor=readRadius(m,n.x,n.y,n.z);
    const wanted=s.grounded&&!jump?floor:freeRadius;
    p.copy(m.centre).addScaledVector(n,Math.max(floor,wanted));
    rotation.setFromUnitVectors(s.up,n);nextUp.copy(viewUp).applyQuaternion(rotation);nextEye.copy(eye).applyQuaternion(rotation);
    if(tideBodyBlocked(p,nextUp,nextEye))return false;
    s.grounded=wanted<=floor+1e-6&&vy<=0;return true;
  }
  const moving=speed!==0&&travel.lengthSq()>0,advanced=candidate(moving);
  if(advanced||moving&&candidate(false)){s.foot.copy(p);transport(s,m.centre);}
  else {
    // No virtual pushback on a physical lean. A head strike ends the rise;
    // the subsequent descending step can still land on the lower surface.
    s.arc.identity();if(vy>0)vy=0;
  }
  s.velocity.copy(travel).multiplyScalar(advanced?speed:0).projectOnPlane(s.up).addScaledVector(s.up,s.grounded?0:vy);
}

/** Follow local radial support and the moon's station/trunk solids. The optional
 * Ecctrl world stays parked on the mother planet throughout a lunar walk. */
export function moonWalk(m:WalkMoon,s:Traveller,travel:Vector3,speed:number,dt:number,jump:boolean,readRadius:Radius=moonRadius,eye?:Vector3,viewUp=s.up){
  if(m.id==='tide'){
    if(!jump&&s.grounded&&(!speed||!travel.lengthSq())){s.arc.identity();s.velocity.set(0,0,0);return;}
    // A fast walking preset or a slow screen frame cannot step through a pile.
    const count=Math.max(1,Math.ceil(travel.length()*speed*dt/.085));
    const startUp=walkStart.copy(s.up),tracked=walkEye.copy(eye??nominalEye.copy(s.up).multiplyScalar(1.65)),up=walkUp.copy(viewUp);
    for(let i=0;i<count;i++){
      tideStep(m,s,travel,speed,dt/count,jump&&i===0,readRadius,tracked,up);
      tracked.applyQuaternion(s.arc);up.applyQuaternion(s.arc);
    }
    s.arc.setFromUnitVectors(startUp,s.up);return;
  }
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
const walkStart=new Vector3(),walkUp=new Vector3(),walkEye=new Vector3();
