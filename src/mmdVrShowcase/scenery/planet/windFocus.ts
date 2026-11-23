import {Vector3} from 'three';
import {lanes,windPoint,moonObstructed,type WindLane,type WindPort} from './windAtlas';
import {stationBlocks,terrainAltitude} from './opalTerrain';
import {moonRadius} from './moonSurface';
import {windTerminalOccludes,windTerminals} from './windTerminalLayout';
import {PAD_RADIUS} from './planetLayout';
import {lanternCanopyBlocks} from './lanternBiosphere';
import {surveyReaderOccludes} from './opalSurvey';

// A standing, seated or lowered eye can read the same collar. Measure
// horizontal distance in the collar's own plane, not in world XZ.
function atPort(eye:Vector3,port:WindPort){
  const x=eye.x-port.foot.x,y=eye.y-port.foot.y,z=eye.z-port.foot.z,h=x*port.up.x+y*port.up.y+z*port.up.z;
  return h>=.08&&h<=2.85?Math.max(0,x*x+y*y+z*z-h*h):Infinity;
}
export function createWindFocus(){
  let chosen:WindLane|null=null,near:WindLane|null=null,onCourse:WindLane|null=null;
  const arcs=new Map(lanes.map(l=>[l,Array.from({length:65},(_,i)=>{const t=i/64;
    return windPoint(l,t,new Vector3()).addScaledVector(l.home.up.clone().lerp(l.away.up,t).normalize(),1.42);})]));
  return {
    select(l:WindLane){chosen=chosen===l?null:l;},
    read(eye:Vector3){
      let nearest:WindLane|null=null,distance=Infinity,keep=Infinity;
      for(const l of lanes){const d=Math.min(atPort(eye,l.home),atPort(eye,l.away));
        if(l===near)keep=d;if(d<distance){distance=d;nearest=l;}}
      if(distance<1.12**2){if(near!==nearest){chosen=null;near=nearest;}onCourse=near;}
      else if(keep>1.44**2)near=null;
      if(chosen&&Math.min(eye.distanceToSquared(chosen.home.foot),eye.distanceToSquared(chosen.away.foot))>13**2)chosen=null;
      if(near)return chosen??near;
      if(onCourse){const l=onCourse;
        // Keep the chosen flight lit after takeoff; do not light a random
        // crossing when the viewer pans around from an overview camera.
        const onArc=arcs.get(l)!.some(p=>eye.distanceToSquared(p)<1.85**2);
        if(!onArc)onCourse=null;
      }
      return chosen??onCourse;
    },
  };
}

export function windPlateSight(lane:WindLane,back:boolean,from:Vector3,hit:Vector3){
  const distance=from.distanceTo(hit);if(!Number.isFinite(distance)||distance<.001||distance>15)return false;
  const site=windTerminals.find(t=>t.lane===lane&&t.back===back)!;
  if(windTerminalOccludes(from,hit,site.world)||!back&&surveyReaderOccludes(from,hit))return false;
  const p=new Vector3(),radial=new Vector3(),steps=Math.ceil(distance/.07);
  for(let i=0;i<=steps;i++){
    p.lerpVectors(from,hit,i/steps);
    if(!back){if(terrainAltitude(p)<-.01||stationBlocks(p,.012,.02)||
      (p.y<0&&p.y>-.34&&Math.hypot(p.x,p.z)<PAD_RADIUS-.01))return false;}
    else {radial.subVectors(p,lane.moon.centre);const r=radial.length();if(r<1e-5)return false;radial.divideScalar(r);
      if(r<moonRadius(lane.moon,radial.x,radial.y,radial.z)-.01||moonObstructed(lane.moon,p,.012,.02)||
        (lane.moon.id==='lantern'&&lanternCanopyBlocks(p)))return false;}
  }return true;
}
