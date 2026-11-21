import {Matrix4,Quaternion,Vector3} from 'three';
import {stations,stationBlocks,crustRadius,terrainAltitude} from './opalTerrain';
import {courseUp} from './opalCourse';
import {PAD_RADIUS,PLANET_RADIUS as R} from './planetLayout';

export type SurveyPlace='dial'|'aqua'|'coral';
export const sampleBit={aqua:1,coral:2} as const;
export const cutStep={aqua:2,coral:4} as const;
export const sampleInk={aqua:'#85edd9',coral:'#ffae90'} as const;
export const blankSurvey={held:false,samples:0,step:0};
export type SurveyState=typeof blankSurvey;
export function surveyRelease(old:SurveyState,place:SurveyPlace):SurveyState {
  if(place==='dial')return old.held?{...old,held:false}:{held:true,samples:0,step:0};
  if(!old.held||(old.samples&sampleBit[place]))return old;
  // The scratches have no head or tail, so 180° is the next zero.
  const step=(old.step+1)%6;
  return {...old,step,samples:old.samples|(step===cutStep[place]?sampleBit[place]:0)};
}
export const lampSpectrum=(s:SurveyState)=>s.held?0:s.samples;

const north=new Vector3(0,1,0),centre=new Vector3(0,-R,0);
function frame(up:Vector3,front:Vector3){return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3().crossVectors(up,front),up,front));}
function apparatus(base:Vector3,up:Vector3,front:Vector3,r:number,height:number,tilt:number){
  const q=frame(up,front),lens=base.clone().addScaledVector(front,r).addScaledVector(up,height);
  return {base,up,front,q,r,height,tilt,lens};
}
function atMineral(name:string){
  const s=stations.find(v=>v.name===name)!;
  const track=courseUp(Math.atan2(-s.up.z,s.up.y)),front=track.addScaledVector(s.up,-track.dot(s.up)).normalize();
  return apparatus(s.base,s.up,front,s.r+.23,.69,-.46);
}
const dialFront=new Vector3(-.54,0,.84).normalize();
export const surveySites={
  dial:apparatus(new Vector3(1.67,0,-2.52),north,dialFront,0,.29,-.91),
  aqua:atMineral('aqua-quartz'),coral:atMineral('coral-quartz'),
};
type P=[number,number,number];
function shot(site:SurveyPlace){
  const s=surveySites[site],eye=s.lens.clone().addScaledVector(s.front,site==='dial'?1.10:1.34);
  const up=site==='dial'?north:eye.clone().sub(centre).normalize();
  if(site==='dial')eye.y=1.46;else eye.copy(centre).addScaledVector(up,crustRadius(up.x,up.y,up.z)+1.49);
  return {eye:eye.toArray() as P,aim:s.lens.toArray() as P,up:up.toArray() as P};
}
export const opalSurveyShots=[{key:'opalSurveyDial',...shot('dial')},{key:'opalSurveyAqua',...shot('aqua')},{key:'opalSurveyCoral',...shot('coral')}] as const;

/** Both ends belong to this short segment. The reader is on the accessible
 * face outside each solid, so there is no blanket exception for its host. */
export function surveySight(from:Vector3,hit:Vector3){
  const len=from.distanceTo(hit);if(!Number.isFinite(len)||len>4.2||len<.001)return false;
  const n=Math.ceil(len/.055),p=new Vector3();
  for(let i=0;i<=n;i++){
    p.lerpVectors(from,hit,i/n);
    if(terrainAltitude(p)<-.009||stationBlocks(p,.008,.008)||
      (p.y<-.005&&p.y>-.35&&p.x*p.x+p.z*p.z<PAD_RADIUS**2))return false;
  }
  return true;
}
