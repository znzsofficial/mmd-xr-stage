import {Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {expect,it} from 'vitest';
import {allMoons,type WalkMoon} from '../scenery/planet/windAtlas';
import {leapRoutes} from '../scenery/planet/leapAtlas';
import {moonRadius,moonShell} from '../scenery/planet/moonSurface';
import {createTraveller,transport} from './planetTravel';
import {moonWalk,MOON_JUMP_SPEED} from './moonWalk';
import {startTwinLeap,stepTwinLeap} from './twinLeap';

const v=()=>new Vector3();
function altitude(m:WalkMoon,p:Vector3,n=v()){
  n.subVectors(p,m.centre);const r=n.length();n.divideScalar(r);return r-moonRadius(m,n.x,n.y,n.z);
}

it.each(allMoons)('$id: ordinary A reaches the analytical apex and lands on its own local relief',m=>{
  const n=v().set(.35,.1,.7).normalize(),radius=moonRadius(m,n.x,n.y,n.z),still=v();
  const apex=MOON_JUMP_SPEED/m.surfaceGravity;
  for(const hz of [36,72,90,120]){
    const s=createTraveller();s.foot.copy(m.centre).addScaledVector(n,radius);transport(s,m.centre);
    expect(startTwinLeap(m,s.foot)).toBeNull();let t=0;
    while(t<apex){const dt=Math.min(1/hz,apex-t);moonWalk(m,s,still,0,dt,t===0);t+=dt;}
    expect(altitude(m,s.foot)).toBeCloseTo(.5*MOON_JUMP_SPEED*apex,9);
    expect(s.velocity.length()).toBeLessThan(1e-9);
    for(let i=0;!s.grounded&&i<3*hz;i++){moonWalk(m,s,still,0,1/hz,false);t+=1/hz;}
    expect(t).toBeCloseTo(2*apex,1);expect(s.grounded).toBe(true);expect(altitude(m,s.foot)).toBeCloseTo(0,10);
  }
});

it.each(leapRoutes)('$pad.id: the marked walk from the north collar or fork to $target.id and back is open',({pad})=>{
  const m=pad.moon,s=createTraveller(),north=v().set(0,1,0),travel=v();
  s.foot.copy(m.centre).addScaledVector(north,moonRadius(m,0,1,0));transport(s,m.centre);
  for(const dest of [pad.up,north]){
    for(let i=0;i<500&&s.up.angleTo(dest)>.006;i++){
      travel.copy(dest).projectOnPlane(s.up).normalize();moonWalk(m,s,travel,2.4,1/90,false);expect(s.grounded).toBe(true);
    }
    expect(s.up.angleTo(dest)).toBeLessThan(.006);
    if(dest===pad.up)expect(startTwinLeap(m,s.foot)?.route.pad).toBe(pad);
  }
});

it.each(leapRoutes)('$pad.id → $target.id: clears all shells from feet through a two-metre head, including at the trigger edges',({pad,target,crest,sight})=>{
  const from=pad.moon,n=v(),foot=v(),up=v(),previous=v(),body=v();
  for(const other of leapRoutes.filter(r=>r.pad.moon===from&&r.pad!==pad))expect(other.pad.foot.distanceTo(pad.foot)).toBeGreaterThan(2);
  expect(startTwinLeap(from,pad.foot.clone().addScaledVector(pad.up,.45))).toBeNull();
  for(const [dy,dz] of [[0,0],...Array.from({length:8},(_,i)=>[.67*Math.cos(i*Math.PI/4),.67*Math.sin(i*Math.PI/4)])]){
    n.copy(pad.foot).sub(from.centre).addScaledVector(crest,dy).addScaledVector(sight,dz).normalize();
    const start=from.centre.clone().addScaledVector(n,moonRadius(from,n.x,n.y,n.z));
    const leap=startTwinLeap(from,start)!;expect(leap.from).toBe(from);
    expect(stepTwinLeap(leap,0,foot,up)).toBe(false);expect(foot.distanceTo(start)).toBeLessThan(1e-8);
    let lowFoot=1,lowEye=10,lowCrown=10,lowBody=10,high=0,rate=0,captures=0;
    const dt=1/144;let done=false;
    for(let i=0;i<144*8&&!done;i++){
      const well=leap.owner;previous.copy(up);done=stepTwinLeap(leap,dt,foot,up);
      if(well!==leap.owner){captures++;expect(leap.owner).toBe(leap.to);expect(done).toBe(false);}
      high=Math.max(high,foot.dot(crest)-Math.max(start.dot(crest),target.foot.dot(crest)));
      rate=Math.max(rate,up.angleTo(previous)/dt);
      for(const m of allMoons){
        lowFoot=Math.min(lowFoot,altitude(m,foot,n));
        for(const h of [.16,.40,.65,.9,1.15,1.40,1.65,1.82,2]){
          body.copy(foot).addScaledVector(up,h);const clear=altitude(m,body,n);
          lowBody=Math.min(lowBody,clear);if(h===1.65)lowEye=Math.min(lowEye,clear);if(h===2)lowCrown=Math.min(lowCrown,clear);
        }
      }
    }
    expect(done).toBe(true);expect(captures).toBe(1);expect(high).toBeGreaterThan(.65);
    expect(rate*180/Math.PI).toBeLessThan(90);expect(lowFoot).toBeGreaterThan(-1e-6);
    expect(lowBody).toBeGreaterThan(.14);expect(lowEye).toBeGreaterThan(1.35);expect(lowCrown).toBeGreaterThan(1.5);
    expect(altitude(leap.to,foot,n)).toBeCloseTo(0,6);expect(up.angleTo(n)).toBeLessThan(1e-6);
    expect(foot.distanceTo(target.foot)).toBeLessThan(.03);expect(startTwinLeap(leap.to,foot)?.to).toBe(from);
  }
});

it.each(leapRoutes)('$pad.id → $target.id: rendered triangles are below feet and outside the standing eye/head trajectory',({pad,target})=>{
  const from=pad.moon,mat=new MeshBasicMaterial(),meshes=[from,target.moon].map(m=>{const mesh=new Mesh(moonShell(m),mat);
    mesh.position.copy(m.centre);mesh.updateMatrixWorld();return mesh;});
  const leap=startTwinLeap(from,pad.foot)!,ray=new Raycaster(),p=v(),up=v(),body=v(),dir=v();
  try{for(let i=0;i<=24;i++){
    const done=stepTwinLeap(leap,i===0?0:leap.eta/23,p,up);
    for(const mesh of meshes)for(const h of [0,1.65,2]){
      body.copy(p).addScaledVector(up,h);dir.subVectors(body,mesh.position).normalize();
      ray.ray.origin.copy(body).addScaledVector(dir,12);ray.ray.direction.copy(dir).negate();
      const hit=ray.intersectObject(mesh)[0];expect(hit).toBeDefined();
      const gap=hit.distance-12;
      expect(gap).toBeGreaterThan(h===0?-.001:1.35);
      if(!h&&(i===0&&mesh.position.equals(from.centre)||done&&mesh.position.equals(leap.to.centre)))expect(gap).toBeLessThan(.008);
    }
  }}finally{mat.dispose();for(const mesh of meshes)mesh.geometry.dispose();}
});

it.each(leapRoutes)('$pad.id → $target.id: measured downrange acceleration changes sign and matches the active inverse-square well',({pad})=>{
  const from=pad.moon,leap=startTwinLeap(from,pad.foot)!;
  const before=pad.foot.clone(),at=before.clone(),after=v(),up=v(),dt=1/120;
  let departure=0,arrival=0;
  stepTwinLeap(leap,dt,at,up);
  for(let i=0;i<700;i++){
    const well=leap.owner,done=stepTwinLeap(leap,dt,after,up);if(done)break;
    const gap=at.distanceTo(well.centre),expected=(well.centre.dot(pad.up)-at.dot(pad.up))*well.surfaceGravity*well.radius**2/gap**3;
    // A fixed-step before/after velocity difference is centred across two
    // acceleration samples. Check away from the discontinuous capture seam.
    if(Math.abs(at.distanceTo(from.centre)-from.radius-at.distanceTo(leap.to.centre)+leap.to.radius)>.2){
      const ax=(after.dot(pad.up)-2*at.dot(pad.up)+before.dot(pad.up))/dt**2;expect(Math.abs(ax-expected)).toBeLessThan(.04);
      if(well===from){expect(ax).toBeLessThan(-.15);departure++;}
      else {expect(ax).toBeGreaterThan(.15);arrival++;}
    }
    before.copy(at);at.copy(after);
  }
  expect(departure).toBeGreaterThan(50);expect(arrival).toBeGreaterThan(50);
});

it.each(leapRoutes)('$pad.id → $target.id: irregular display steps reproduce the same in-flight samples and terrain impact',({pad})=>{
  const from=pad.moon,start=pad.foot,ref=startTwinLeap(from,start)!,foot=v(),up=v(),wantFoot=v(),wantUp=v();
  const clock=[.25,.64,1.51,2.25,2.74,3.12,5];
  const traces=clock.map(t=>{const done=stepTwinLeap(ref,t-ref.time,wantFoot,wantUp);return {foot:wantFoot.clone(),up:wantUp.clone(),well:ref.owner,done};});
  for(const frames of [[1/36],[1/72],[1/90],[1/120],[.007,.029,.013,.043]]){
    const leap=startTwinLeap(from,start)!;let t=0,j=0;
    clock.forEach((sample,i)=>{let done=false;
      while(t<sample){const dt=Math.min(frames[j++%frames.length],sample-t);done=stepTwinLeap(leap,dt,foot,up);t+=dt;}
      expect(foot.distanceTo(traces[i].foot)).toBeLessThan(1e-8);expect(up.distanceTo(traces[i].up)).toBeLessThan(1e-8);
      expect(leap.owner).toBe(traces[i].well);expect(done).toBe(traces[i].done);
    });
  }
});
