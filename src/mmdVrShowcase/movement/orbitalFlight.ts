import {Vector3} from 'three';
import {moonObstructed} from '../scenery/planet/windAtlas';
import {stationBlocks} from '../scenery/planet/opalTerrain';
import {MOON_JUMP_SPEED} from './moonWalk';
import {fixtureBodyBlocked} from './planetFixtures';
import {altitude,createShellSweep} from './orbitalSurfaces';
import {clearOfSkim,shellContactNormal} from './orbitalContactGeometry';
import {homeWorld,walkWorlds,type World,localWell,pull} from './gravityField';
import type {ReadColumn} from './groundMotor';
import {STEP} from './solidColumns';

export {localWell,pull};
function jumpImpulse(w:World,up:Vector3,stick:Vector3,speed:number,out:Vector3){
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
      out.copy(stick).projectOnPlane(up).setLength(2.4).addScaledVector(up,4.85);return 'transfer';
    }
  }
  out.copy(stick).projectOnPlane(up).multiplyScalar(speed).clampLength(0,.62*circular)
    .addScaledVector(up,w.id==='home'?1.9:MOON_JUMP_SPEED);return 'local';
}
export function jumpVelocity(w:World,up:Vector3,stick:Vector3,speed:number,out:Vector3){
  jumpImpulse(w,up,stick,speed,out);return out;
}

type ShellSweep=ReturnType<typeof createShellSweep>;
export function startOrbit(w:World,foot:Vector3,velocity?:Vector3){return {
  from:w,owner:w as World|null,foot:foot.clone(),velocity:velocity?.clone()??new Vector3(),changes:0,grazes:0,first:true,trackedHeight:0,localHop:false,
  landing:null as World|null,point:new Vector3(),up:new Vector3(),tracked:false,part:'foot' as 'foot'|'head'|'body',
  sweep:createShellSweep(),a:new Vector3(),move:new Vector3(),next:new Vector3(),column:{floor:-Infinity,ceiling:Infinity,blocked:false},
  tickLeft:0,impacts:0,gravity:new Vector3(),drift:new Vector3(),skim:null as World|null,normal:new Vector3(),
  tested:false,hit:null as ReturnType<ShellSweep>,hitLeft:Infinity,testedEye:new Vector3(),testedUp:new Vector3(),testedHeight:0,
  rim:null as Vector3|null,fixtureLip:null as Vector3|null,side:new Vector3(),across:new Vector3(),probe:new Vector3(),
};}
export type Orbit=ReturnType<typeof startOrbit>;

/** The off-mark transfer is a different takeoff impulse. Keep its horizon
 * from the very first chord, including flights that skim rather than land. */
export function startJump(w:World,foot:Vector3,up:Vector3,stick:Vector3,speed:number){
  const f=startOrbit(w,foot);f.localHop=jumpImpulse(w,up,stick,speed,f.velocity)==='local';return f;
}

// Obstructions on the imported north pad and the finite station/tree proxies
// remain solids during a jump. Flying in the free movement mode bypasses this.
function obstacle(f:Orbit,to:Vector3,up:Vector3,eye:Vector3,read?:ReadColumn){
  const h=Math.max(.25,f.trackedHeight+.115),w=f.owner;
  if(w&&fixtureBodyBlocked(w.id,to,up,eye,.16,f.trackedHeight))return 'wall';
  if(w&&to.distanceTo(w.centre)-w.radius<3.3&&(w.id==='home'?stationBlocks(to,.16,h):moonObstructed(w,to,.16,h)))return 'wall';
  if(!read||to.y<-.3)return;
  const c=f.column,sole=Math.abs(to.x)<=4&&Math.abs(to.z)<=4;
  if(sole){
    c.floor=-Infinity;c.ceiling=Infinity;c.blocked=false;read(to.x,to.z,f.foot.y,c);
    if(c.blocked)return 'wall';
    if(to.y<c.floor&&to.y<=f.foot.y){f.point.set(to.x,c.floor,to.z);f.up.subVectors(f.point,homeWorld.centre).normalize();return 'floor';}
  }
  // The support belongs to the motor sole; the overhead clearance belongs
  // to the actual eye. Do not treat the visitor's lean as virtual travel.
  const rising=to.y>f.foot.y,lateral=to.x!==f.foot.x||to.z!==f.foot.z;
  if(!rising&&!lateral)return;
  const x=to.x+eye.x,z=to.z+eye.z;if(Math.abs(x)>4||Math.abs(z)>4)return;
  const headBottom=f.foot.y+eye.y-.115;
  if(!sole||eye.x!==0||eye.z!==0||c.ceiling<headBottom){
    // Column queries accept a step at refY + STEP. Ignore a low platform
    // under the offset eye without misclassifying a thin overhead panel.
    c.floor=-Infinity;c.ceiling=Infinity;c.blocked=false;read(x,z,headBottom-STEP,c);
  }
  const lid=c.ceiling;if(to.y+eye.y+.115<=lid)return;
  if(lateral&&f.foot.y+eye.y+.115>lid+.00001){
    // Entering the side of a low beam need not be an upward step. Compare
    // against the *same* tracked pose at the previous motor foot; already
    // leaning into it is not a lateral impact to undo.
    c.floor=-Infinity;c.ceiling=Infinity;c.blocked=false;read(f.foot.x+eye.x,f.foot.z+eye.z,headBottom-STEP,c);
    if(c.ceiling>lid+.00001)return 'wall';
    c.ceiling=lid;
  }
  if(rising)return 'ceiling';
}

// A wall refuses lateral travel, not gravity. If the radial fall itself runs
// into the top of a non-walkable station, ease over the nearest lip; do not
// freeze the foot there accumulating metres per second of downward velocity.
function slideAtWall(f:Orbit,h:number,viewUp:Vector3,eye:Vector3,read?:ReadColumn){
  const onFixture=!!f.owner&&fixtureBodyBlocked(f.owner.id,f.next,viewUp,eye,.16,f.trackedHeight);
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

function beginChord(f:Orbit){
  const w=localWell(f.foot,f.owner);if(w!==f.owner){f.owner=w;f.changes++;f.localHop=false;}
  pull(w,f.foot,f.gravity);f.tickLeft=Math.min(1/120,.065/Math.max(.01,f.velocity.length()));f.impacts=0;f.tested=false;
  f.drift.copy(f.velocity).addScaledVector(f.gravity,.5*f.tickLeft);
}

// Solve the *same* chord at 72 and 144 Hz. Carry a pending static-shell
// hit only while tracking is identical. Prop-limited moves are never cached.
function nextHit(f:Orbit,whole:boolean,h:number,up:Vector3,eye:Vector3){
  if(!whole||!f.tested||f.testedHeight!==f.trackedHeight||!f.testedEye.equals(eye)||!f.testedUp.equals(up)){
    f.tested=whole;f.testedEye.copy(eye);f.testedUp.copy(up);f.testedHeight=f.trackedHeight;
    const span=whole?f.tickLeft:h;
    f.hit=f.sweep(f.foot,whole?f.probe.copy(f.drift).multiplyScalar(span):f.move,up,eye,f.trackedHeight);
    f.hitLeft=f.hit?f.hit.t*span:Infinity;
  }
  return f.hitLeft<=h+1e-12?f.hit:null;
}

function skim(f:Orbit,hit:NonNullable<Orbit['hit']>){
  const n=shellContactNormal(hit.world,hit.point,hit.up,hit.part==='foot'?0:hit.part==='head'?.115:.15,f.normal,f.probe);
  const speed=f.velocity.dot(n),inward=Math.max(0,-speed),tangent=Math.sqrt(Math.max(0,f.velocity.lengthSq()-speed*speed));
  if(!(tangent>3.8&&inward<tangent*(2/3)||hit.world!==f.from&&tangent>1.4&&inward<tangent*.22))return false;
  if(hit.world!==f.from||hit.part==='head')f.localHop=false;
  if(f.skim!==hit.world){
    f.velocity.projectOnPlane(n).multiplyScalar(.95).addScaledVector(n,Math.max(speed,.48,inward*.38));f.grazes++;f.skim=hit.world;
  }else if(inward>0)f.velocity.addScaledVector(n,inward);
  f.drift.copy(f.velocity).addScaledVector(f.gravity,.5*f.tickLeft);f.impacts++;
  return true;
}

/** Ballistic translation, independent of renderer, tracking basis and Rapier.
 * Real tracking loss freezes this clock at the caller. Position and velocity
 * are never reset when changing wells or crossing their outer boundary. */
export function stepOrbit(f:Orbit,dt:number,viewUp:Vector3,eyeOffset:Vector3,read?:ReadColumn,trackedHeight=eyeOffset.dot(viewUp),
  carryView?:(next:Vector3,h:number)=>void){
  if(f.landing)return true;
  f.trackedHeight=trackedHeight;
  let time=Math.max(0,Math.min(.15,dt));
  if(time>0&&f.first){
    f.first=false;
    // A tracked lean beside a fixture need not have a clear launch volume.
    // Refuse the impulse on its existing support rather than sliding sideways.
    const w=f.from;
    if(fixtureBodyBlocked(w.id,f.foot,viewUp,eyeOffset,.16,trackedHeight)&&Math.abs(altitude(w,f.foot))<.001){
      f.landing=w;f.point.copy(f.foot);f.up.subVectors(f.foot,w.centre).normalize();f.velocity.set(0,0,0);return true;
    }
  }
  while(time>1e-12){
    // Fixed integration chords; the display can consume part of one without
    // resampling its well or waiting for another XR frame to show movement.
    if(f.tickLeft<=1e-12)beginChord(f);
    const h=Math.min(time,f.tickLeft);
    // Several zero-time constraints in a crease: wait out this chord at the
    // last safe point rather than advancing unchecked or charging friction.
    if(f.impacts>=4){time-=h;f.tickLeft-=h;continue;}
    let ballistic=!f.fixtureLip;
    if(!ballistic)slideToLip(f,h,viewUp,eyeOffset,read);
    else {f.move.copy(f.drift).multiplyScalar(h);f.next.copy(f.foot).add(f.move);}
    // Rotate at the current foot under a clearance check, THEN sweep the body
    // with the very same up/eye that will be displayed and seated on impact.
    if(f.localHop&&ballistic)carryView?.(f.next,h);
    let blocked=obstacle(f,f.next,viewUp,eyeOffset,read);
    if(blocked==='wall'){
      if(ballistic)f.velocity.addScaledVector(f.gravity,h);
      ballistic=false;
      slideAtWall(f,h,viewUp,eyeOffset,read);f.move.subVectors(f.next,f.foot);blocked=obstacle(f,f.next,viewUp,eyeOffset,read);
    }
    else f.rim=null;
    if(blocked==='ceiling'){
      f.next.y=Math.max(f.foot.y,f.column.ceiling-eyeOffset.y-.115);f.move.subVectors(f.next,f.foot);
    }
    const hit=nextHit(f,ballistic&&!blocked,h,viewUp,eyeOffset),spent=hit?Math.min(f.hitLeft,h):h;
    time-=spent;f.tickLeft-=spent;f.hitLeft-=spent;
    if(ballistic)f.velocity.addScaledVector(f.gravity,spent);
    if(hit){
      f.tested=false;f.foot.addScaledVector(f.move,spent/h);
      if(skim(f,hit))continue; // the unspent time starts at the impact, with the outgoing velocity
      f.landing=f.owner=hit.world;f.point.copy(hit.point);f.up.copy(hit.up);f.part=hit.part;f.tracked=hit.tracked;f.velocity.set(0,0,0);return true;
    }
    if(blocked==='floor'){f.landing=f.owner=homeWorld;f.foot.copy(f.point);f.velocity.set(0,0,0);return true;}
    if(blocked==='ceiling'){f.velocity.y=0;f.tickLeft=0;}else if(!ballistic)f.tickLeft=0;
    f.foot.copy(f.next);
    if(f.skim&&f.tickLeft<=1e-12&&clearOfSkim(f.skim,f.foot,viewUp,eyeOffset,trackedHeight,f.probe))f.skim=null;
  }
  return false;
}
