import {Quaternion,Vector3} from 'three';
import {stationBlocks} from '../scenery/planet/opalTerrain';
import {moonObstructed} from '../scenery/planet/windAtlas';
import {altitude,walkWorlds,type World} from './orbitalSurfaces';
import {fixtureBlocks,fixtureBodyBlocked} from './planetFixtures';
import {tideSolid} from '../scenery/planet/tideLayout';
import {tideBodyBlocked} from './tideContact';
import {eyeLift} from './eyeHeight';
import type {ReadColumn} from './groundMotor';

const head=.115,up=new Vector3(),eye=new Vector3(),point=new Vector3(),base=new Vector3();
const col={floor:-Infinity,ceiling:Infinity,blocked:false};

// Only called for artificial transforms. Read imported solids at the actual
// sample, not a column through the motor sole (or a previous frame's eye).
function pointGap(p:Vector3,r:number,read:ReadColumn){
  let gap=Infinity;
  for(const w of walkWorlds){
    if(p.distanceToSquared(w.centre)>(w.radius+4+r)**2)continue;
    gap=Math.min(gap,altitude(w,p)-r);
    if(w.id==='home'&&p.y>-3){
      col.floor=-Infinity;col.ceiling=Infinity;col.blocked=false;read(p.x,p.z,p.y-r,col);
      gap=Math.min(gap,p.y-r-col.floor,col.ceiling-(p.y+r));if(col.blocked)return -Infinity;
    }
  }
  return gap;
}

/** A Y press has one destination: the current tracked pose about the existing
 * motor sole, in its tangent basis. Test it before dropping any compensation. */
function canStand(w:World,foot:Vector3,basis:Quaternion,tracked:Vector3,lift:number,read:ReadColumn){
  up.set(0,1,0).applyQuaternion(basis);eye.copy(tracked);eye.y+=lift;
  const h=eye.y;eye.applyQuaternion(basis);
  const r=w.id==='home'?.22:.19;
  if(fixtureBodyBlocked(w.id,foot,up,eye,r,h)||w.id==='tide'&&tideBodyBlocked(foot,up,eye,h))return false;
  if(w.id==='home'?stationBlocks(foot,r,h):w.id!=='tide'&&moonObstructed(w,foot,r,1.74))return false;
  const n=Math.max(1,Math.ceil(h/.15));
  for(let i=0;i<=n;i++){
    // Taper at the ankle: a level pad can be oblique to radial up.
    const t=h*i/n,radius=i===n?head:Math.min(.15,Math.max(0,.75*t));
    point.copy(foot).add(eye).addScaledVector(up,t-h);
    if(pointGap(point,radius,read)<-.0003)return false;
    if(w.id==='home'?stationBlocks(point,r,.15):w.id!=='tide'&&moonObstructed(w,point,r,.15))return false;
  }
  return true;
}

type Stance={foot:Vector3;basis:Quaternion;seat:Vector3;groundTilt:Quaternion;display:Quaternion;viewUp:Vector3};
export function alignPlanetStance(w:World,s:Stance,tracked:Vector3,lift:number,read:ReadColumn){
  if(!canStand(w,s.foot,s.basis,tracked,lift,read))return false;
  s.seat.set(0,0,0);s.groundTilt.identity();s.display.copy(s.basis);s.viewUp.copy(up);return true;
}

/** Move only the artificial part of eye height. A physical lean on an already
 * admitted setting is always 1:1. In shell contact a calibration step back
 * out is allowed; the tracking transform itself is never separated. */
export function fitPlanetLift(w:World|null,foot:Vector3,axis:Vector3,trackedEye:Vector3,height:number,previous:number,wanted:number,read:ReadColumn){
  if(previous===wanted)return previous;
  const target=wanted<previous?Math.min(previous,eyeLift(wanted,height)):wanted;
  if(target===previous)return previous;
  const n=Math.ceil(Math.abs(target-previous)/.025);
  point.copy(foot).add(trackedEye).addScaledVector(axis,previous);
  let gap=pointGap(point,head,read),allowed=previous;
  for(let i=1;i<=n;i++){
    const candidate=i===n?target:previous+(target-previous)*i/n;
    point.copy(foot).add(trackedEye).addScaledVector(axis,candidate);
    const next=pointGap(point,head,read);
    if(next<0&&!(next>gap))break;
    if(w){
      // Only the crown travels: the tracked sole does not move when editing
      // height. Test a short cylinder about this sample, including its cap.
      base.copy(point).addScaledVector(axis,-head);
      if(fixtureBlocks(w.id,base,head,2*head,axis))break;
      if(w.id==='tide'){base.copy(point);base.y-=head;if(tideSolid(base,head,2*head))break;}
      else if(w.id==='home'?stationBlocks(base,head,2*head):moonObstructed(w,base,head,2*head))break;
    }
    gap=next;allowed=candidate;
  }
  return allowed;
}
