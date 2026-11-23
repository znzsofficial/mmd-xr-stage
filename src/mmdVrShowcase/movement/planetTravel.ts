import {Quaternion,Vector3} from 'three';
import {homeGravity,PAD_RADIUS,PLANET_RADIUS as R} from '../scenery/planet/planetLayout';
import type {ReadColumn} from './groundMotor';
import {STEP} from './solidColumns';
import {crustRadius,stationBlocks} from '../scenery/planet/opalTerrain';

export const planetCentre=new Vector3(0,-R,0),north=new Vector3(0,1,0);
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
  const crust=crustRadius(n.x,n.y,n.z);if(stationBlocks(p,.22,height))return NaN;
  if(n.y<=.8)return crust;
  const pad=R/n.y,px=n.x*pad,pz=n.z*pad;
  const floor=Math.hypot(px,pz)<=PAD_RADIUS?0:crust*n.y-R;
  const c=s.col;c.floor=floor;c.blocked=false;c.ceiling=Infinity;
  read(px,pz,s.foot.y,c);
  return c.blocked||Math.max(c.floor,s.foot.y)+height>c.ceiling ? NaN : Math.max(crust,(R+c.floor)/n.y);
}

/** Always available, even with a cached module rejection. Move the existing
 * foot, never a second XR origin. A late physics body is seeded from this pose. */
export function surfaceStep(s:Traveller,travel:Vector3,speed:number,dt:number,jump:boolean,read:ReadColumn,height:number){
  const p=s.destination.copy(s.foot).addScaledVector(travel,speed*dt);
  const radius=s.foot.distanceTo(planetCentre);
  let floor=support(s,p,read,height);
  if(!Number.isFinite(floor)) {p.copy(s.foot);floor=support(s,p,read,height);if(!Number.isFinite(floor))return;}
  let vy=s.velocity.dot(s.up);
  if(jump&&s.grounded)vy=1.45;
  const gravity=homeGravity(radius);
  let r=radius+vy*dt-.5*gravity*dt*dt;vy-=gravity*dt;
  // Radial distance decreases while walking towards the middle of the flat
  // north deck. Follow reachable downhill support instead of leaving the
  // deck on a tangent and repeatedly entering a tiny fall.
  if(s.grounded&&!jump&&floor<=radius&&radius-floor<=STEP)r=floor;
  if(s.radial.y>.8&&Number.isFinite(s.col.ceiling)&&vy>0){
    const max=(R+s.col.ceiling-height)/s.radial.y;
    if(r>max){r=max;vy=0;}
  }
  s.grounded=r<=floor+.000001&&vy<=0;
  if(s.grounded)vy=0;
  s.foot.copy(planetCentre).addScaledVector(s.radial,Math.max(floor,r));
  transport(s);s.velocity.copy(travel).multiplyScalar(speed).projectOnPlane(s.up).addScaledVector(s.up,vy);
}

export interface PlanetDriver {
  ready():boolean;
  seed(s:Traveller):void;
  step(s:Traveller,dt:number,x:number,forward:number,jump:boolean,localEye:Vector3):void;
  stop():void;
}
