import {Mesh,MeshBasicMaterial,Raycaster,Vector3} from 'three';
import {expect,it} from 'vitest';
import {leapAt} from '../scenery/planet/leapAtlas';
import {allMoons,steppingMoons} from '../scenery/planet/windAtlas';
import {moonRadius,moonSegments,moonShell} from '../scenery/planet/moonSurface';
import {crustRadius,crustSegments,makeCrust} from '../scenery/planet/opalTerrain';
import {facetSampler} from '../scenery/planet/shellFacets';
import {altitude,createShellSweep,homeWorld,shellRadius,walkWorlds,type World} from './orbitalSurfaces';
import {jumpVelocity,localWell,pull,startOrbit,stepOrbit} from './orbitalFlight';

const moon=(id:string)=>allMoons.find(m=>m.id===id)!;
const surface=(w:World,n:Vector3)=>w.centre.clone().addScaledVector(n,shellRadius(w,n.x,n.y,n.z));
const salt=moon('salt'),glaze=moon('glaze');

it.each(walkWorlds)('$id swept relief encloses the actual rendered facets, including near both poles and the UV seam',w=>{
  const geo=w.id==='home'?makeCrust(false):moonShell(w),mat=new MeshBasicMaterial(),mesh=new Mesh(geo,mat),ray=new Raycaster();
  const [cols,rows]=w.id==='home'?crustSegments:moonSegments(w),face=facetSampler(cols,rows,w.id==='home'?crustRadius:(x,y,z)=>moonRadius(w,x,y,z));
  try{for(const n of [new Vector3(-1,.23,.00001),new Vector3(-1,.23,-.00001),new Vector3(.013,1,-.003),new Vector3(-.003,-1,.011),new Vector3(.24,.76,-.61)]){
    n.normalize();ray.ray.origin.copy(n).multiplyScalar(w.radius+5);ray.ray.direction.copy(n).negate();
    const radius=ray.intersectObject(mesh)[0].point.length();expect(face(n.x,n.y,n.z)).toBeCloseTo(radius,5);
    expect(shellRadius(w,n.x,n.y,n.z)).toBeGreaterThanOrEqual(radius-1e-5);
  }}finally{geo.dispose();mat.dispose();}
});

it.each([[salt,glaze],[glaze,salt]])('non-footprint running launch %o → %o keeps its momentum at acquisition and contacts the actual neighbour', (from,to)=>{
  const axis=to.centre.clone().sub(from.centre).normalize();
  const up=axis.clone().multiplyScalar(Math.cos(.30)).addScaledVector(new Vector3(0,1,0),Math.sin(.30));
  const foot=surface(from,up),stick=axis.clone().projectOnPlane(up).normalize(),head=up.clone().multiplyScalar(1.95);
  expect(leapAt(from,foot)).toBeUndefined();
  for(const dt of [1/120,1/72,.135]){
    const f=startOrbit(from,foot,jumpVelocity(from,up,stick,2.4,new Vector3()));
    for(let i=0;i<7/dt&&!f.landing;i++){
      const prev=f.foot.clone(),speed=f.velocity.length();stepOrbit(f,dt,up,head);
      expect(f.foot.distanceTo(prev)).toBeLessThanOrEqual(speed*dt+2*dt**2+.0001);
      for(const w of [from,to])for(const h of [0,.35,.85,1.3,1.95])expect(altitude(w,f.foot.clone().addScaledVector(up,h))).toBeGreaterThan(-.001);
    }
    expect(f.landing).toBe(to);expect(f.changes).toBe(1);expect(altitude(to,f.point)).toBeCloseTo(0,6);
    expect(f.part).toBe('head');
  }
});

it.each(walkWorlds)('$id is a physical ground even when starting with a different gravity owner',w=>{
  const up=new Vector3(.25,.90,-.04).normalize(),foot=surface(w,up),eye=up.clone().multiplyScalar(1.8);
  const f=startOrbit(w===salt?homeWorld:salt,foot.clone().addScaledVector(up,.7),up.clone().multiplyScalar(-.4));
  for(let i=0;i<180&&!f.landing;i++)stepOrbit(f,1/72,up,eye);
  expect(f.landing).toBe(w);expect(f.changes).toBe(1);expect(f.point.distanceTo(foot)).toBeLessThan(.002);
});

it('sweeps the interior of a translated body: both endpoints, feet and head can all miss a grazing shell',()=>{
  const sweep=createShellSweep(),w=steppingMoons[1],up=new Vector3(0,1,0),eye=up.clone().multiplyScalar(2.2);
  // Translate across the flattened landing cap. Both ends of the step are
  // outside; its mid-height sections graze the equator, not either endpoint.
  const n=w.jumpHeadings![0],side=new Vector3().crossVectors(up,n).normalize();
  for(const sign of [-1,1]){
    const middle=surface(w,n).addScaledVector(n,.06),start=middle.clone().addScaledVector(up,-1.1).addScaledVector(side,sign*5);
    const delta=side.clone().multiplyScalar(-sign*10);const hit=sweep(start,delta,up,eye);
    expect(hit?.world).toBe(w);expect(hit?.part).toBe('body');expect(hit!.t).toBeGreaterThan(.30);expect(hit!.t).toBeLessThan(.5);
    for(const y of [-1.1,1.1])expect(altitude(w,middle.clone().addScaledVector(up,y))).toBeGreaterThan(.12);
  }
});

it('at a slow display rate a fast tangent strike skips, a direct strike stops, and a distant escape is ballistic',()=>{
  const w=steppingMoons[1],up=new Vector3(0,1,0),eye=up.clone().multiplyScalar(1.8),zero=new Vector3();
  const n=new Vector3(0,1,0),crown=surface(w,n);
  const inbound=startOrbit(homeWorld,crown.clone().addScaledVector(up,5),new Vector3(0,-100,0));
  expect(stepOrbit(inbound,.14,up,eye)).toBe(true);expect(inbound.landing).toBe(w);expect(inbound.foot.y).toBeGreaterThan(crown.y-.001);
  const axis=w.jumpHeadings![0],cross=new Vector3().crossVectors(up,axis).normalize();
  const skim=startOrbit(w,surface(w,axis).addScaledVector(axis,-.06).addScaledVector(cross,-3),cross.clone().multiplyScalar(53));
  stepOrbit(skim,.14,up,eye);expect(skim.grazes).toBeGreaterThan(0);expect(skim.landing).toBeNull();expect(skim.velocity.dot(cross)).toBeGreaterThan(25);
  const far=new Vector3(211,200,300),v=new Vector3(3,1,-.3),drift=startOrbit(homeWorld,far,v);
  stepOrbit(drift,.14,up,eye);expect(drift.owner).toBeNull();expect(pull(drift.owner,drift.foot,zero).length()).toBe(0);
  expect(drift.velocity.equals(v)).toBe(true);expect(drift.foot.distanceTo(far.clone().addScaledVector(v,.14))).toBeLessThan(1e-10);
});

it('does not ping-pong in overlapping wells; a quiet hop falls back under every local gravity',()=>{
  const midpoint=surface(salt,new Vector3(1,0,0)).add(new Vector3(3.6,0,0));
  for(const well of [salt,glaze])for(const offset of [-.15,.15,-.20,.20])expect(localWell(midpoint.clone().add(new Vector3(offset,0,0)),well)).toBe(well);
  for(const w of walkWorlds){
    const up=new Vector3(0,1,0),f=startOrbit(w,surface(w,up),jumpVelocity(w,up,new Vector3(),2.4,new Vector3()));
    let apex=0;for(let i=0;i<400&&!f.landing;i++){stepOrbit(f,1/90,up,new Vector3(0,1.75,0));apex=Math.max(apex,altitude(w,f.foot));}
    expect(f.landing).toBe(w);expect(apex).toBeGreaterThan(.3);expect(f.changes).toBe(0);
  }
});
