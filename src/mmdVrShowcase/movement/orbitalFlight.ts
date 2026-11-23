import {Vector3} from 'three';
import {moonObstructed} from '../scenery/planet/windAtlas';
import {stationBlocks} from '../scenery/planet/opalTerrain';
import {MOON_JUMP_SPEED} from './moonWalk';
import {createShellSweep,homeWorld,walkWorlds,type World} from './orbitalSurfaces';
import type {ReadColumn} from './groundMotor';

const gap=(w:World,p:Vector3)=>p.distanceTo(w.centre)-w.radius;
const reach=(w:World)=>4+w.radius*1.8;
/** Only a nearby well can acquire. A visitor crossing the seam retains the
 * current well until another wins by half a metre, not merely one frame. */
export function localWell(p:Vector3,owner:World|null){
  let best=owner&&gap(owner,p)<reach(owner)+1?owner:null,score=best?gap(best,p)-.55:Infinity;
  for(const w of walkWorlds){const d=gap(w,p);if(d<score&&d<reach(w)){best=w;score=d;}}
  return best;
}
export function pull(w:World|null,p:Vector3,out:Vector3){
  if(!w)return out.set(0,0,0);
  out.subVectors(w.centre,p);const r=out.length(),d=r-w.radius;
  // Ordinary stationary lunar hops retain their calibrated surface gravity.
  // Outside that near layer pull falls as inverse square, then fades to zero.
  const reference=w.radius+(w.id==='home'?0:1.25),fade=Math.min(1,Math.max(0,(reach(w)-d)/2));
  return out.multiplyScalar(w.surfaceGravity*(reference/Math.max(reference,r))**2*fade*fade*(3-2*fade)/Math.max(r,1e-9));
}
export function jumpVelocity(w:World,up:Vector3,stick:Vector3,speed:number,out:Vector3){
  // Standing A is a local hop. A moving takeoff adds a push along the
  // departure normal; aim by choosing the takeoff slope and stick heading.
  const drive=Math.min(1,stick.length());
  return out.copy(stick).projectOnPlane(up).multiplyScalar(speed)
    .addScaledVector(up,(w.id==='home'?2.4:MOON_JUMP_SPEED)+(3.25+.52*Math.max(0,speed-2.4))*drive);
}

export function startOrbit(w:World,foot:Vector3,velocity:Vector3){return {
  from:w,owner:w as World|null,foot:foot.clone(),velocity:velocity.clone(),changes:0,grazes:0,
  landing:null as World|null,point:new Vector3(),up:new Vector3(),tracked:false,part:'foot' as 'foot'|'head'|'body',
  sweep:createShellSweep(),a:new Vector3(),move:new Vector3(),next:new Vector3(),column:{floor:-Infinity,ceiling:Infinity,blocked:false},
};}
export type Orbit=ReturnType<typeof startOrbit>;

// Obstructions on the imported north pad and the finite station/tree proxies
// remain solids during a jump. Flying in the free movement mode bypasses this.
function obstacle(f:Orbit,to:Vector3,up:Vector3,eye:Vector3,read?:ReadColumn){
  const h=Math.max(.25,eye.dot(up)+.115),w=f.owner;
  if(w&&gap(w,to)<3.3&&(w.id==='home'?stationBlocks(to,.16,h):moonObstructed(w,to,.16,h)))return 'wall';
  if(!read||Math.abs(to.x)>4||Math.abs(to.z)>4||to.y<-.3)return;
  const c=f.column;c.floor=-Infinity;c.ceiling=Infinity;c.blocked=false;read(to.x,to.z,f.foot.y,c);
  if(c.blocked)return 'wall';
  if(to.y<c.floor&&f.velocity.y<=0){f.point.set(to.x,c.floor,to.z);f.up.subVectors(f.point,homeWorld.centre).normalize();return 'floor';}
  if(to.y+eye.y+.115>c.ceiling&&f.velocity.y>0)return 'ceiling';
}

/** Ballistic translation, independent of renderer, tracking basis and Rapier.
 * Real tracking loss freezes this clock at the caller. Position and velocity
 * are never reset when changing wells or crossing their outer boundary. */
export function stepOrbit(f:Orbit,dt:number,viewUp:Vector3,eyeOffset:Vector3,read?:ReadColumn){
  if(f.landing)return true;
  const time=Math.max(0,Math.min(.15,dt)),steps=Math.max(1,Math.ceil(time*120),Math.ceil(f.velocity.length()*time/.065)),h=time/steps;
  for(let i=0;i<steps&&h>0;i++){
    const w=localWell(f.foot,f.owner);if(w!==f.owner){f.owner=w;f.changes++;}
    pull(w,f.foot,f.a);f.move.copy(f.velocity).multiplyScalar(h).addScaledVector(f.a,.5*h*h);
    f.next.copy(f.foot).add(f.move);f.velocity.addScaledVector(f.a,h);
    const hit=f.sweep(f.foot,f.move,viewUp,eyeOffset);
    if(hit){
      f.foot.addScaledVector(f.move,hit.t);
      const inward=Math.max(0,-f.velocity.dot(hit.up));
      const tangent=Math.sqrt(Math.max(0,f.velocity.lengthSq()-inward*inward));
      // Fast shallow contact skims the shell. A weak field alone never
      // sticks a passing visitor to an arbitrary nearest sphere.
      if(tangent>3.8&&inward<tangent*.65){
        f.velocity.projectOnPlane(hit.up).multiplyScalar(.95).addScaledVector(hit.up,Math.max(.48,inward*.38));f.grazes++;continue;
      }
      f.landing=f.owner=hit.world;f.point.copy(hit.point);f.up.copy(hit.up);f.part=hit.part;f.tracked=hit.tracked;f.velocity.set(0,0,0);return true;
    }
    const blocked=obstacle(f,f.next,viewUp,eyeOffset,read);
    if(blocked==='floor'){f.landing=f.owner=homeWorld;f.foot.copy(f.point);f.velocity.set(0,0,0);return true;}
    if(blocked==='ceiling'){f.velocity.y=0;continue;}
    if(blocked==='wall'){
      // Keep radial fall under gravity while refusing the lateral step.
      const radial=f.a.subVectors(f.foot,w?.centre??homeWorld.centre).normalize(),v=f.velocity.dot(radial);
      f.velocity.copy(radial).multiplyScalar(Math.min(0,v));continue;
    }
    f.foot.copy(f.next);
  }
  return false;
}
