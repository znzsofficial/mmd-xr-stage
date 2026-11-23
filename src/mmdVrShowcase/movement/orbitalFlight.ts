import {Vector3} from 'three';
import {moonObstructed} from '../scenery/planet/windAtlas';
import {stationBlocks} from '../scenery/planet/opalTerrain';
import {MOON_JUMP_SPEED} from './moonWalk';
import {tideBodyBlocked} from './tideContact';
import {fixtureBodyBlocked} from './planetFixtures';
import {altitude,createShellSweep,homeWorld,walkWorlds,type World} from './orbitalSurfaces';
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
  // A local running jump must not enter an orbit: the smallest moon's
  // circular speed is below even the normal walking preset. Stick magnitude
  // buys tangential travel, never a bigger vertical kick on an ordinary hop.
  const drive=stick.length(),circular=Math.sqrt(w.surfaceGravity*w.radius);
  if(speed>=2.39&&drive>=.96){
    for(const other of walkWorlds){
      if(other===w)continue;
      out.subVectors(other.centre,w.centre);const d=out.length();
      if(d-w.radius-other.radius>7.6)continue;
      out.divideScalar(d);if(out.dot(up)<Math.cos(.43))continue;
      // Aim down the hillside towards the opposing shore, not backwards,
      // along its edge, or straight up. This is only a launch impulse; the
      // free trajectory still has to physically hit the neighbour.
      out.projectOnPlane(up);if(out.lengthSq()<.005||out.normalize().dot(stick)<drive*.94)continue;
      return out.copy(stick).projectOnPlane(up).setLength(2.4).addScaledVector(up,4.85);
    }
  }
  return out.copy(stick).projectOnPlane(up).multiplyScalar(speed).clampLength(0,.62*circular)
    .addScaledVector(up,w.id==='home'?1.9:MOON_JUMP_SPEED);
}

export function startOrbit(w:World,foot:Vector3,velocity:Vector3){return {
  from:w,owner:w as World|null,foot:foot.clone(),velocity:velocity.clone(),changes:0,grazes:0,first:true,
  landing:null as World|null,point:new Vector3(),up:new Vector3(),tracked:false,part:'foot' as 'foot'|'head'|'body',
  sweep:createShellSweep(),a:new Vector3(),move:new Vector3(),next:new Vector3(),column:{floor:-Infinity,ceiling:Infinity,blocked:false},
  rim:null as Vector3|null,fixtureLip:null as Vector3|null,side:new Vector3(),across:new Vector3(),probe:new Vector3(),
};}
export type Orbit=ReturnType<typeof startOrbit>;

// Obstructions on the imported north pad and the finite station/tree proxies
// remain solids during a jump. Flying in the free movement mode bypasses this.
function obstacle(f:Orbit,to:Vector3,up:Vector3,eye:Vector3,read?:ReadColumn){
  const h=Math.max(.25,eye.dot(up)+.115),w=f.owner;
  if(w&&fixtureBodyBlocked(w.id,to,up,eye,.16))return 'wall';
  if(w?.id==='tide'){if(tideBodyBlocked(to,up,eye))return 'wall';}
  else if(w&&gap(w,to)<3.3&&(w.id==='home'?stationBlocks(to,.16,h):moonObstructed(w,to,.16,h)))return 'wall';
  if(!read||Math.abs(to.x)>4||Math.abs(to.z)>4||to.y<-.3)return;
  const c=f.column;c.floor=-Infinity;c.ceiling=Infinity;c.blocked=false;read(to.x,to.z,f.foot.y,c);
  if(c.blocked)return 'wall';
  if(to.y<c.floor&&f.velocity.y<=0){f.point.set(to.x,c.floor,to.z);f.up.subVectors(f.point,homeWorld.centre).normalize();return 'floor';}
  if(to.y+eye.y+.115>c.ceiling&&f.velocity.y>0)return 'ceiling';
}

// A wall refuses lateral travel, not gravity. If the radial fall itself runs
// into the top of a non-walkable station, ease over the nearest lip; do not
// freeze the foot there accumulating metres per second of downward velocity.
function slideAtWall(f:Orbit,h:number,viewUp:Vector3,eye:Vector3,read?:ReadColumn){
  const onFixture=!!f.owner&&fixtureBodyBlocked(f.owner.id,f.next,viewUp,eye,.16);
  const n=f.a.subVectors(f.foot,f.owner?.centre??homeWorld.centre).normalize(),v=Math.min(0,f.velocity.dot(n));
  f.velocity.copy(n).multiplyScalar(v);f.next.copy(f.foot).addScaledVector(n,v*h);
  if(obstacle(f,f.next,viewUp,eye,read)!=='wall'){f.rim=null;return;}
  if(!f.rim){
    f.side.set(0,0,1);if(Math.abs(n.z)>.9)f.side.set(1,0,0);
    f.side.projectOnPlane(n).normalize();f.across.crossVectors(n,f.side);
    for(let radius=.18;radius<2.6&&!f.rim&&!f.fixtureLip;radius+=.18)for(let i=0;i<12;i++){
      const a=i*Math.PI/6;f.probe.copy(f.next).addScaledVector(n,-.12).addScaledVector(f.side,radius*Math.cos(a)).addScaledVector(f.across,radius*Math.sin(a));
      if(obstacle(f,f.probe,viewUp,eye,read))continue;
      // The nearest open point can be over the HIGH edge of a tilted face.
      // From first contact its horizontal approach would enter the panel and
      // leave the body hovering. Choose a reachable lip on the downhill side.
      if(!onFixture){f.rim=f.probe.clone();break;}
      let clear=true;
      for(let d=Math.min(.95*h,radius);;d=Math.min(radius,d+.055)){
        f.move.copy(f.foot).addScaledVector(f.side,d*Math.cos(a)).addScaledVector(f.across,d*Math.sin(a));
        if(obstacle(f,f.move,viewUp,eye,read)==='wall'){clear=false;break;}
        if(d===radius)break;
      }
      if(clear){f.fixtureLip=f.move.clone();break;}
    }
  }
  f.velocity.set(0,0,0);f.next.copy(f.foot);
  if(f.fixtureLip){slideToLip(f,h,viewUp,eye,read);return;}
  if(f.rim){f.side.subVectors(f.rim,f.foot).projectOnPlane(n);
    if(f.side.lengthSq()<.015**2)f.rim=null;else f.next.add(f.side.clampLength(0,.95*h));
    if(obstacle(f,f.next,viewUp,eye,read)==='wall'&&obstacle(f,f.foot,viewUp,eye,read)!=='wall'){f.next.copy(f.foot);f.rim=null;}}
}

function slideToLip(f:Orbit,h:number,up:Vector3,eye:Vector3,read?:ReadColumn){
  f.move.subVectors(f.fixtureLip!,f.foot).clampLength(0,.95*h);f.next.copy(f.foot).add(f.move);
  if(obstacle(f,f.next,up,eye,read)==='wall'){f.move.set(0,0,0);f.next.copy(f.foot);f.fixtureLip=null;}
  else if(f.next.distanceToSquared(f.fixtureLip!)<1e-8)f.fixtureLip=null;
  f.velocity.copy(f.move).multiplyScalar(1/h);
}

/** Ballistic translation, independent of renderer, tracking basis and Rapier.
 * Real tracking loss freezes this clock at the caller. Position and velocity
 * are never reset when changing wells or crossing their outer boundary. */
export function stepOrbit(f:Orbit,dt:number,viewUp:Vector3,eyeOffset:Vector3,read?:ReadColumn){
  if(f.landing)return true;
  const time=Math.max(0,Math.min(.15,dt)),steps=Math.max(1,Math.ceil(time*120),Math.ceil(f.velocity.length()*time/.065)),h=time/steps;
  if(time>0&&f.first){
    f.first=false;
    // The cut floor continues underneath solid rock. A radial foot on that
    // floor, or a tracked lean beside a wall, need not have a clear launch
    // volume. Refuse the impulse on its existing support instead of sending
    // an already intersecting body sideways in search of a landing.
    const w=f.from;
    if((fixtureBodyBlocked(w.id,f.foot,viewUp,eyeOffset,.16)||w.id==='tide'&&tideBodyBlocked(f.foot,viewUp,eyeOffset))&&Math.abs(altitude(w,f.foot))<.001){
      f.landing=w;f.point.copy(f.foot);f.up.subVectors(f.foot,w.centre).normalize();f.velocity.set(0,0,0);return true;
    }
  }
  for(let i=0;i<steps&&h>0;i++){
    const w=localWell(f.foot,f.owner);if(w!==f.owner){f.owner=w;f.changes++;}
    if(f.fixtureLip)slideToLip(f,h,viewUp,eyeOffset,read);
    else {pull(w,f.foot,f.a);f.move.copy(f.velocity).multiplyScalar(h).addScaledVector(f.a,.5*h*h);
      f.next.copy(f.foot).add(f.move);f.velocity.addScaledVector(f.a,h);}
    let blocked=obstacle(f,f.next,viewUp,eyeOffset,read);
    if(blocked==='wall'){slideAtWall(f,h,viewUp,eyeOffset,read);f.move.subVectors(f.next,f.foot);blocked=obstacle(f,f.next,viewUp,eyeOffset,read);}
    else f.rim=null;
    const hit=f.sweep(f.foot,f.move,viewUp,eyeOffset);
    if(hit){
      f.foot.addScaledVector(f.move,hit.t);
      const inward=Math.max(0,-f.velocity.dot(hit.up));
      const tangent=Math.sqrt(Math.max(0,f.velocity.lengthSq()-inward*inward));
      // Fast shallow contact skims the shell. A weak field alone never
      // sticks a passing visitor to an arbitrary nearest sphere.
      if(tangent>3.8&&inward<tangent*.65||hit.world!==f.from&&tangent>1.4&&inward<tangent*.22){
        f.velocity.projectOnPlane(hit.up).multiplyScalar(.95).addScaledVector(hit.up,Math.max(.48,inward*.38));f.grazes++;continue;
      }
      f.landing=f.owner=hit.world;f.point.copy(hit.point);f.up.copy(hit.up);f.part=hit.part;f.tracked=hit.tracked;f.velocity.set(0,0,0);return true;
    }
    if(blocked==='floor'){f.landing=f.owner=homeWorld;f.foot.copy(f.point);f.velocity.set(0,0,0);return true;}
    if(blocked==='ceiling'){f.velocity.y=0;continue;}
    f.foot.copy(f.next);
  }
  return false;
}
