import {Matrix4,Quaternion,Vector3} from 'three';
import {stations,stationBlocks,crustRadius,terrainAltitude} from './opalTerrain';
import {courseUp} from './opalCourse';
import {PAD_RADIUS,PLANET_RADIUS as R} from './planetLayout';
import {readerWorldBoxes,type ReaderBox} from './surveyHardware';
import {surveyOccupancy} from './surveyOccupancy';

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
function apparatus(base:Vector3,up:Vector3,eye:Vector3,cameraUp:Vector3,mineralRadius:number,height:number){
  const front=eye.clone().sub(base).projectOnPlane(up).normalize(),q=frame(up,front),r=mineralRadius?mineralRadius+.22:0;
  const lens=base.clone().addScaledVector(front,r).addScaledVector(up,height),view=eye.clone().sub(lens);
  return {base,up,front,q,r,height,mineralRadius,tilt:-Math.atan2(view.dot(up),view.dot(front)),lens,eye,cameraUp};
}
function atMineral(name:string,lead:number){
  const s=stations.find(v=>v.name===name)!;
  const track=courseUp(Math.atan2(-s.up.z,s.up.y)-lead);
  const eye=centre.clone().addScaledVector(track,crustRadius(track.x,track.y,track.z)+1.54);
  return apparatus(s.base,s.up,eye,track,s.r,.84);
}
export const surveySites={
  dial:apparatus(new Vector3(1,0,-2.98),north,new Vector3(.70,1.54,-1.31),north,0,.82),
  aqua:atMineral('aqua-quartz',.05),coral:atMineral('coral-quartz',.10),
};
export const surveyReaderBoxes:readonly ReaderBox[]=Object.values(surveySites).flatMap(readerWorldBoxes);
const occupied=surveyOccupancy(surveyReaderBoxes),axis=new Vector3();
export function surveyReaderBlocks(worldFoot:Vector3,r:number,h:number,up?:Vector3){
  return occupied(worldFoot,(up?axis.copy(up):axis.subVectors(worldFoot,centre)).normalize(),h,r);
}
export function surveyReaderOccludes(from:Vector3,to:Vector3,endTolerance=0){
  axis.subVectors(to,from);const len=axis.length();return occupied(from,axis.normalize(),Math.max(0,len-endTolerance),0);
}
type P=[number,number,number];
function shot(site:SurveyPlace){
  const s=surveySites[site];return {eye:s.eye.toArray() as P,aim:s.lens.toArray() as P,up:s.cameraUp.toArray() as P};
}
export const opalSurveyShots=[{key:'opalSurveyDial',...shot('dial')},{key:'opalSurveyAqua',...shot('aqua')},{key:'opalSurveyCoral',...shot('coral')}] as const;

/** Both ends belong to this short segment. The reader is on the accessible
 * face outside each solid, so there is no blanket exception for its host. */
export function surveySight(from:Vector3,hit:Vector3){
  const len=from.distanceTo(hit);if(!Number.isFinite(len)||len>4.2||len<.001)return false;
  // The hit is on the casting's shared front boundary. Stop one tenth of a
  // millimetre short there; do not exempt the target cabinet, its arms or feet.
  if(surveyReaderOccludes(from,hit,.0001))return false;
  const n=Math.ceil(len/.055),p=new Vector3();
  for(let i=0;i<=n;i++){
    p.lerpVectors(from,hit,i/n);
    if(terrainAltitude(p)<-.009||stationBlocks(p,.008,.008)||
      (p.y<-.005&&p.y>-.35&&p.x*p.x+p.z*p.z<PAD_RADIUS**2))return false;
  }
  return true;
}
