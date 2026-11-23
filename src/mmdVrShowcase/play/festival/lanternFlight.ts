import { Vector3 } from 'three';
import type { SceneryId } from '../../scenery/catalog';
import type { GripFrame } from '../propView';

export const POD_LIMIT=3, SCHOOL_SIZE=5, PETALS=6;
export const BLOOM_AT=.86, SWIM_AT=1.26, SHELL_END=2.7, SHOW_END=5.3;
export {lanternGrip,lanternOutlet} from './fittings';

const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export function ease(x:number){x=clamp(x);return x*x*(3-2*x);}
export const petalOpening=(age:number)=>ease((age-BLOOM_AT)/.78);
export const shellSize=(age:number)=>(.48+.52*ease(age/.34))*(1-ease((age-1.91)/(SHELL_END-1.91)));

export function lanternTangent(direction:Vector3,up:Vector3,out:Vector3){
  out.copy(direction).projectOnPlane(up);
  if(out.lengthSq()<.0001){const useX=Math.abs(up.x)<.8;out.set(useX?1:0,0,useX?0:1).projectOnPlane(up);}
  return out.normalize();
}

/** Same contract as sampleStageGravity: write acceleration, return this traveller's next owner. */
type SampleGravity<W>=(room:SceneryId,point:Vector3,previous:W|null,acceleration:Vector3)=>W|null;
const traveller=<W>()=>({point:new Vector3(),up:new Vector3(0,1,0),owner:null as W|null});
const newPod=<W>()=>({...traveller<W>(),age:-1,dir:new Vector3(),phase:0,
  school:Array.from({length:SCHOOL_SIZE},()=>({...traveller<W>(),age:-1,lane:new Vector3()}))});
export type LanternPodState=ReturnType<typeof newPod<unknown>>;

// A little fan in the plane of the local horizon. The tall centre jelly is
// followed by alternating left/right lanterns, not a stack behind the outlet.
const fans=[[.04,.50,.32],[-.76,.22,.22],[.88,-.22,.28],[-1,-.40,.34],[.55,.65,.19]] as const;
const liftDistance=(t:number)=>.038*t+.155*Math.min(t,1.5);
const coast=(t:number)=>.69*(1-Math.exp(-2.7*t));

export function createLanternFlight<W>(sampleGravity:SampleGravity<W>){
  const pods=Array.from({length:POD_LIMIT},()=>newPod<W>());
  const sample=new Vector3(),forward=new Vector3(),side=new Vector3(),along=new Vector3();
  let room:SceneryId|undefined,serial=0;

  function readUp(id:SceneryId,body:ReturnType<typeof traveller<W>>){
    body.owner=sampleGravity(id,body.point,body.owner,sample);
    // In field-free space carry the last measured up instead of snapping at a well boundary.
    if(sample.lengthSq()>1e-10)body.up.copy(sample).normalize().negate();
  }
  function clear(){
    for(const p of pods){p.age=-1;p.owner=null;for(const j of p.school){j.age=-1;j.owner=null;}}
  }
  function step(id:SceneryId,{at,dir,usable,action,dt}:GripFrame){
    const crossed=room!==undefined&&room!==id;room=id;
    if(!usable||crossed){clear();return;}
    const delta=Math.min(.05,Math.max(0,dt));
    for(const p of pods){
      if(p.age<0)continue;
      const old=p.age,t=p.age+=delta;
      if(t>=SHOW_END){p.age=-1;for(const j of p.school)j.age=-1;continue;}
      if(old<SHELL_END){
        readUp(id,p);
        p.point.addScaledVector(p.dir,coast(t)-coast(old)).addScaledVector(p.up,liftDistance(t)-liftDistance(old));
      }
      for(let i=0;i<p.school.length;i++){
        const j=p.school[i],age=t-SWIM_AT-i*.105;if(age<0)continue;
        const [x,z,speed]=fans[i];
        if(j.age<0){
          lanternTangent(p.dir,p.up,forward);side.crossVectors(forward,p.up);
          j.lane.copy(side).multiplyScalar(x).addScaledVector(forward,z).normalize();
          j.point.copy(p.point).addScaledVector(p.up,.047).addScaledVector(j.lane,.015);
          j.up.copy(p.up);j.owner=p.owner;
        }
        const h=age-Math.max(0,j.age);j.age=age;
        readUp(id,j);
        along.copy(j.lane).projectOnPlane(j.up);
        // The bell briefly contracts as it swims. Some lateral motion stays
        // after the petals have dispersed; it doesn't track a moving wrist.
        const pulse=Math.sin(age*4.1+i);
        j.point.addScaledVector(j.up,h*(speed+.042*pulse)).addScaledVector(along,h*(.205/(1+age*.87)));
      }
    }
    if(action!=='start'||dir.lengthSq()<1e-10)return;
    const p=pods.find(s=>s.age<0);if(!p)return; // A full pool drops this press. No queued launches.
    p.age=0;p.phase=(serial++%29)*2.39996;p.point.copy(at);p.dir.copy(dir).normalize();
    p.owner=null;p.up.set(0,1,0);readUp(id,p);
    for(const j of p.school){j.age=-1;j.owner=null;}
  }
  return {pods,step,clear};
}
