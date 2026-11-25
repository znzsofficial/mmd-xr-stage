import {Quaternion,Vector3} from 'three';
import {stationBlocks} from '../scenery/planet/opalTerrain';
import {moonObstructed} from '../scenery/planet/windAtlas';
import {altitude,shellRadius,walkWorlds,type World} from './orbitalSurfaces';
import {fixtureBlocks,fixtureBodyBlocked} from './planetFixtures';
import {tideSolid} from '../scenery/planet/tideLayout';
import {tideBodyBlocked} from './tideContact';
import {eyeLift} from './eyeHeight';
import type {ReadColumn} from './groundMotor';
import {STEP} from './solidColumns';
import {homeWorld} from './gravityReference';
import {carryFrame,type Traveller} from './planetTravel';

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

/** Test the entire standing pose before dropping any contact compensation. */
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

type Stance={foot:Vector3;up:Vector3;basis:Quaternion;seat:Vector3;groundTilt:Quaternion;display:Quaternion;viewUp:Vector3};
const standingFoot=new Vector3(),radial=new Vector3(),previous=new Vector3(),across=new Vector3(),centred=new Vector3();
const standingBasis=new Quaternion(),swing=new Quaternion();

// On a home hop the horizon can follow the small arc travelled over the
// mother planet, just as on a stride. Never point at a newly acquired well.
// Check the virtual motion of the tracked body, not the direction of gaze.
export function carryHomeHop(s:Traveller,foot:Vector3,targetUp:Vector3,tracked:Vector3,lift:number,dt:number,read:ReadColumn){
  const angle=s.up.angleTo(targetUp);if(angle<1e-8)return;
  // An offset ankle can win the sweep. Limit the final approach just like an
  // airborne frame: no instantaneous rotation to a distant contact normal.
  swing.setFromUnitVectors(s.up,targetUp);
  const fraction=Math.min(1,dt*.65/angle);
  const steps=Math.max(1,Math.ceil(angle*fraction*(tracked.length()+Math.abs(lift))/.025));
  for(let i=1;i<=steps;i++){
    standingBasis.identity().slerp(swing,fraction*i/steps).multiply(s.basis);
    if(!canStand(homeWorld,foot,standingBasis,tracked,lift,read))return;
  }
  carryFrame(s,radial.set(0,1,0).applyQuaternion(standingBasis));
}

// While the stick actually advances across open ground, bring the motor
// under the physical footprint a stride at a time. A lean at rest (or into a
// wall) still tracks 1:1: never move the viewer to enforce this correction.
export function followHomeFootprint(s:Traveller,offset:Vector3,p:{x:number;y:number;z:number},lift:number,stride:number,read:ReadColumn){
  across.set(p.x-offset.x,0,p.z-offset.z);
  const distance=across.length();if(distance<.0001||stride<.0001)return false;
  across.multiplyScalar(Math.min(1,stride/distance,.08/distance));
  standingFoot.copy(across).applyQuaternion(s.basis).add(s.foot);radial.subVectors(standingFoot,homeWorld.centre).normalize();
  let floor=shellRadius(homeWorld,radial.x,radial.y,radial.z);
  if(radial.y>.8){
    col.floor=homeWorld.centre.y+radial.y*floor;col.ceiling=Infinity;col.blocked=false;
    read(standingFoot.x,standingFoot.z,s.foot.y,col);if(col.blocked)return false;
    floor=Math.max(floor,(col.floor-homeWorld.centre.y)/radial.y);
  }
  if(Math.abs(floor-s.foot.distanceTo(homeWorld.centre))>STEP)return false;
  standingFoot.copy(homeWorld.centre).addScaledVector(radial,floor);
  standingBasis.copy(s.basis).premultiply(swing.setFromUnitVectors(s.up,radial));
  centred.set(0,p.y,0);if(!canStand(homeWorld,standingFoot,standingBasis,centred,lift,read))return false;
  centred.set(p.x-offset.x-across.x,p.y,p.z-offset.z-across.z);
  if(centred.x**2+centred.z**2>1e-8&&!canStand(homeWorld,standingFoot,standingBasis,centred,lift,read))return false;
  s.foot.copy(standingFoot);carryFrame(s,radial);offset.add(across);return true;
}

export function alignPlanetStance(w:World,s:Stance,tracked:Vector3,lift:number,read:ReadColumn){
  const distance=Math.hypot(tracked.x,tracked.z);
  if(distance>1e-6){
    // A real step/lean leaves the displayed sole on the OLD tangent plane.
    // Testing that plane at the new XZ can bury an ankle in an open slope.
    // Only on explicit Y: follow reachable support to the tracked footprint,
    // rather than recentering the visitor sideways or ignoring a real wall.
    // A tracking discontinuity wider than the whole supported world isn't
    // a reachable footprint. Bound the explicit sweep, not room-scale steps.
    if(distance>2*s.foot.distanceTo(w.centre))return false;
    // A side step was made in the DISPLAYED frame. Reinterpreting its X/Z
    // in the navigation basis can mirror it after an opposing-shell capture.
    across.set(tracked.x,0,tracked.z).applyQuaternion(s.display);centred.set(0,tracked.y,0);
    previous.copy(s.foot);const steps=Math.ceil(distance/.08);
    for(let i=0;i<=steps;i++){
      standingFoot.copy(s.foot).addScaledVector(across,i/steps);
      radial.subVectors(standingFoot,w.centre).normalize();
      if(i){
        let floor=shellRadius(w,radial.x,radial.y,radial.z);
        if(w.id==='home'&&radial.y>.8){
          col.floor=w.centre.y+floor*radial.y;col.ceiling=Infinity;col.blocked=false;
          read(standingFoot.x,standingFoot.z,previous.y,col);if(col.blocked)return false;
          floor=Math.max(floor,(col.floor-w.centre.y)/radial.y);
        }
        if(Math.abs(floor-previous.distanceTo(w.centre))>STEP)return false;
        standingFoot.copy(w.centre).addScaledVector(radial,floor);
      }
      standingBasis.copy(s.basis).premultiply(swing.setFromUnitVectors(s.up,radial));
      if(!canStand(w,standingFoot,standingBasis,centred,lift,read))return false;
      previous.copy(standingFoot);
    }
    s.foot.copy(standingFoot);s.up.copy(radial);s.basis.copy(standingBasis);
  }else if(!canStand(w,s.foot,s.basis,tracked,lift,read))return false;
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
