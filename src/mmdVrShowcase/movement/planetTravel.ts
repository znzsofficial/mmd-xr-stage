import {Quaternion,Vector3} from 'three';
import {homeGravity,PLANET_RADIUS as R} from '../scenery/planet/planetLayout';
import type {ReadColumn} from './groundMotor';
import {STEP} from './solidColumns';
import {stationBlocks} from '../scenery/planet/opalTerrain';
import {fixtureBodyBlocked} from './planetFixtures';
import {headMargin} from './eyeHeight';

import {homeShellRadius,planetCentre} from './homeSurface';
export {planetCentre};
export const north=new Vector3(0,1,0);
// Ecctrl's .3 m half-capsule + .3 m radius + .2 m suspension.
export const bodyAboveFoot=.8;
export function createTraveller(){return {
  foot:new Vector3(0,0,1.9),up:north.clone(),basis:new Quaternion(),dir:new Vector3(),velocity:new Vector3(),grounded:true,
  destination:new Vector3(),radial:new Vector3(),arc:new Quaternion(),col:{floor:0,ceiling:Infinity,blocked:false},
};}
export type Traveller=ReturnType<typeof createTraveller>;
export function transport(s:Traveller,centre=planetCentre){
  s.radial.subVectors(s.foot,centre).normalize();
  s.basis.premultiply(s.arc.setFromUnitVectors(s.up,s.radial)).normalize();s.up.copy(s.radial);
}

// Radial support on the sphere or the tangent landing pad. Imported props &
// actors are authored on this pad only. Use their real column on its near side.
function support(s:Traveller,p:Vector3,read:ReadColumn,height:number){
  const n=s.radial.subVectors(p,planetCentre).normalize();
  const crust=homeShellRadius(n.x,n.y,n.z);if(stationBlocks(p,.22,height))return NaN;
  if(n.y<=.8)return crust;
  const c=s.col;c.floor=crust*n.y-R;c.blocked=false;c.ceiling=Infinity;
  read(p.x,p.z,s.foot.y,c);
  return c.blocked||Math.max(c.floor,s.foot.y)+height>c.ceiling ? NaN : Math.max(crust,(R+c.floor)/n.y);
}

const eye=new Vector3(),view=new Vector3(),nextEye=new Vector3(),nextView=new Vector3(),rotation=new Quaternion();
function fallbackStep(s:Traveller,travel:Vector3,speed:number,dt:number,jump:boolean,read:ReadColumn,height:number){
  const radius=s.foot.distanceTo(planetCentre),v=s.grounded?(jump?1.45:0):s.velocity.dot(s.up),gravity=homeGravity(radius);
  function candidate(move:boolean){
    const p=s.destination.copy(s.foot);if(move)p.addScaledVector(travel,speed*dt);
    const floor=support(s,p,read,height);if(!Number.isFinite(floor))return false;
    let vy=v-gravity*dt,r=radius+v*dt-.5*gravity*dt*dt;
    // Follow reachable downhill support on the flat north pad.
    if(s.grounded&&!jump&&radius-floor<=STEP)r=floor;
    if(s.radial.y>.8&&Number.isFinite(s.col.ceiling)&&vy>0){
      const max=(R+s.col.ceiling-height)/s.radial.y;
      if(r>max){r=max;vy=0;}
    }
    p.copy(planetCentre).addScaledVector(s.radial,Math.max(floor,r));
    rotation.setFromUnitVectors(s.up,s.radial);nextEye.copy(eye).applyQuaternion(rotation);nextView.copy(view).applyQuaternion(rotation);
    if(fixtureBodyBlocked('home',p,nextView,nextEye,.22))return false;
    s.grounded=r<=floor+.000001&&vy<=0;
    s.foot.copy(p);transport(s);s.velocity.copy(travel).multiplyScalar(move?speed:0).projectOnPlane(s.up).addScaledVector(s.up,s.grounded?0:vy);return true;
  }
  const moving=speed!==0&&travel.lengthSq()>0;
  if(!candidate(moving)&&!(moving&&candidate(false))){s.arc.identity();s.velocity.set(0,0,0);}
}

/** Always available, even with a cached module rejection. Move the existing
 * foot, never a second XR origin. A late physics body is seeded from this pose. */
export function surfaceStep(s:Traveller,travel:Vector3,speed:number,dt:number,jump:boolean,read:ReadColumn,height:number,trackedEye?:Vector3,viewUp=s.up){
  if(trackedEye)eye.copy(trackedEye);else eye.copy(s.up).multiplyScalar(height-headMargin);
  view.copy(viewUp);
  const count=Math.max(1,Math.ceil(travel.length()*speed*dt/.085));
  for(let i=0;i<count;i++){
    fallbackStep(s,travel,speed,dt/count,jump&&i===0,read,height);
    eye.applyQuaternion(s.arc);view.applyQuaternion(s.arc);
  }
}

export interface PlanetDriver {
  ready():boolean;
  seed(s:Traveller):void;
  step(s:Traveller,dt:number,x:number,forward:number,localEye:Vector3,read:ReadColumn):void;
  stop():void;
}
