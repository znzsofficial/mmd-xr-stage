import {Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {expect,it} from 'vitest';
import {moons,type Moon} from '../scenery/planet/windAtlas';
import {moonRadius,moonShell} from '../scenery/planet/moonSurface';
import {createTraveller,transport} from './planetTravel';
import {moonWalk,MOON_JUMP_SPEED} from './moonWalk';
import {startTwinLeap,stepTwinLeap,twinPad} from './twinLeap';

const twins=moons.filter(m=>m.id==='salt'||m.id==='glaze'),v=()=>new Vector3();
function altitude(m:Moon,p:Vector3,n=v()){
  n.subVectors(p,m.centre);const r=n.length();n.divideScalar(r);return r-moonRadius(m,n.x,n.y,n.z);
}

it.each(moons)('$id: ordinary A reaches the analytical apex and lands on its own local relief',m=>{
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

it.each(twins)('$id: clears both shells from foot through a two-metre head at the centre and edges of the pad',from=>{
  const pad=twinPad(from)!,n=v(),foot=v(),up=v(),previous=v(),body=v();
  expect(startTwinLeap(from,pad.foot.clone().addScaledVector(pad.up,.45))).toBeNull();
  for(const [dy,dz] of [[0,0],[.64,0],[-.64,0],[0,.64],[0,-.64]]){
    n.copy(pad.foot).sub(from.centre).add(v().set(0,dy,dz)).normalize();
    const start=from.centre.clone().addScaledVector(n,moonRadius(from,n.x,n.y,n.z));
    const leap=startTwinLeap(from,start)!;expect(leap.from).toBe(from);
    expect(stepTwinLeap(leap,0,foot,up)).toBe(false);expect(foot.distanceTo(start)).toBeLessThan(1e-8);
    let lowFoot=1,lowEye=10,lowCrown=10,lowBody=10,high=0,rate=0,captures=0;
    const dt=1/144;let done=false;
    for(let i=0;i<144*8&&!done;i++){
      const well=leap.owner;previous.copy(up);done=stepTwinLeap(leap,dt,foot,up);
      if(well!==leap.owner){captures++;expect(leap.owner).toBe(leap.to);expect(done).toBe(false);}
      high=Math.max(high,foot.y-Math.max(start.y,twinPad(leap.to)!.foot.y));
      rate=Math.max(rate,up.angleTo(previous)/dt);
      for(const m of twins){
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
    expect(foot.distanceTo(twinPad(leap.to)!.foot)).toBeLessThan(.03);expect(startTwinLeap(leap.to,foot)?.to).toBe(from);
  }
});

it.each(twins)('$id: rendered triangles are below both feet and outside the standing eye/head trajectory',from=>{
  const mat=new MeshBasicMaterial(),meshes=twins.map(m=>{const mesh=new Mesh(moonShell(m),mat);
    mesh.position.copy(m.centre);mesh.updateMatrixWorld();return mesh;});
  const leap=startTwinLeap(from,twinPad(from)!.foot)!,ray=new Raycaster(),p=v(),up=v(),body=v(),dir=v();
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

it.each(twins)('$id: measured downrange acceleration changes sign and matches the active inverse-square well',from=>{
  const pad=twinPad(from)!,leap=startTwinLeap(from,pad.foot)!;
  const before=pad.foot.clone(),at=before.clone(),after=v(),up=v(),dt=1/120;
  let departure=0,arrival=0;
  stepTwinLeap(leap,dt,at,up);
  for(let i=0;i<700;i++){
    const well=leap.owner,done=stepTwinLeap(leap,dt,after,up);if(done)break;
    const gap=at.distanceTo(well.centre),expected=(well.centre.x-at.x)*well.surfaceGravity*well.radius**2/gap**3;
    // A fixed-step before/after velocity difference is centred across two
    // acceleration samples. Check away from the discontinuous capture seam.
    if(Math.abs(at.distanceTo(from.centre)-from.radius-at.distanceTo(leap.to.centre)+leap.to.radius)>.2){
      const ax=(after.x-2*at.x+before.x)/dt**2;expect(Math.abs(ax-expected)).toBeLessThan(.04);
      if(well===from){expect(ax*pad.up.x).toBeLessThan(-.2);departure++;}
      else {expect(ax*pad.up.x).toBeGreaterThan(.2);arrival++;}
    }
    before.copy(at);at.copy(after);
  }
  expect(departure).toBeGreaterThan(50);expect(arrival).toBeGreaterThan(50);
});

it.each(twins)('$id: irregular display steps reproduce the same in-flight samples and terrain impact',from=>{
  const start=twinPad(from)!.foot,ref=startTwinLeap(from,start)!,foot=v(),up=v(),wantFoot=v(),wantUp=v();
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
