import {Quaternion,Vector3} from 'three';
import {moonObstructed,type WalkMoon} from '../scenery/planet/windAtlas';
import {moonRadius} from '../scenery/planet/moonSurface';
import {transport,type Traveller} from './planetTravel';
import {fixtureBodyBlocked} from './planetFixtures';

export const MOON_JUMP_SPEED=1.6; // m/s; equal impulse, different heights and hang times

const rotation=new Quaternion(),nextUp=new Vector3(),nextEye=new Vector3(),nominalEye=new Vector3();
type Radius=(m:WalkMoon,x:number,y:number,z:number)=>number;
const before=new Vector3(),after=new Vector3(),sample=new Vector3();
function gap(m:WalkMoon,point:Vector3,read:Radius){
  sample.subVectors(point,m.centre);const r=sample.length();return r-read(m,sample.x/r,sample.y/r,sample.z/r);
}
function walkStep(m:WalkMoon,s:Traveller,travel:Vector3,speed:number,dt:number,jump:boolean,readRadius:Radius,eye:Vector3,viewUp:Vector3,height:number){
  const from=s.foot,r=from.distanceTo(m.centre),v=s.grounded?(jump?MOON_JUMP_SPEED:0):s.velocity.dot(s.up);
  let vy=v-m.surfaceGravity*dt;
  const freeRadius=r+v*dt-.5*m.surfaceGravity*dt*dt,p=s.destination,n=s.radial;
  function candidate(move:boolean){
    p.copy(from);if(move)p.addScaledVector(travel,speed*dt);
    n.subVectors(p,m.centre).normalize();const floor=readRadius(m,n.x,n.y,n.z);
    const wanted=s.grounded&&!jump?floor:freeRadius;
    p.copy(m.centre).addScaledVector(n,Math.max(floor,wanted));
    rotation.setFromUnitVectors(s.up,n);nextUp.copy(viewUp).applyQuaternion(rotation);nextEye.copy(eye).applyQuaternion(rotation);
    if(fixtureBodyBlocked(m.id,p,nextUp,nextEye,.19,height))return false;
    if(move&&nextUp.dot(n)<.65){
      // A retained side/head-first stance can bring the crown up against a
      // ridge even while the motor sole has good support. Reject only inward
      // virtual travel, not a real lean or a step back out of the rock.
      const count=Math.max(1,Math.ceil(height/.18));
      for(let i=0;i<=count;i++){
        const dy=-height*i/count,r=i===0?.115:i===count?0:.15;
        after.copy(p).add(nextEye).addScaledVector(nextUp,dy);const to=gap(m,after,readRadius);
        if(to<r-.0003&&to<gap(m,before.copy(from).add(eye).addScaledVector(viewUp,dy),readRadius)-.00015)return false;
      }
    }
    // Floor is radial support. Trunks and instruments obstruct travel.
    if(moonObstructed(m,p,.19,1.74))return false;
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
 * Rapier world stays parked on the mother planet throughout a lunar walk. */
export function moonWalk(m:WalkMoon,s:Traveller,travel:Vector3,speed:number,dt:number,jump:boolean,readRadius:Radius=moonRadius,eye?:Vector3,viewUp=s.up,height=eye?.dot(viewUp)??1.65){
  if(!jump&&s.grounded&&(!speed||!travel.lengthSq())){s.arc.identity();s.velocity.set(0,0,0);return;}
  // A fast walking preset or a slow screen frame cannot step through a post.
  const count=Math.max(1,Math.ceil(travel.length()*speed*dt/.085));
  const startUp=walkStart.copy(s.up),tracked=walkEye.copy(eye??nominalEye.copy(s.up).multiplyScalar(1.65)),up=walkUp.copy(viewUp);
  for(let i=0;i<count;i++){
    walkStep(m,s,travel,speed,dt/count,jump&&i===0,readRadius,tracked,up,height);
    tracked.applyQuaternion(s.arc);up.applyQuaternion(s.arc);
  }
  s.arc.setFromUnitVectors(startUp,s.up);
}
const walkStart=new Vector3(),walkUp=new Vector3(),walkEye=new Vector3();
