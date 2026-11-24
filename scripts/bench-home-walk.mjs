// node --single-threaded scripts/bench-home-walk.mjs
// One installed WASM world, no renderer. Rows are native axes / elapsed XR
// time / measured sole travel, not the commanded or reported body velocity.
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import os from 'node:os';
import Rapier from '@dimforge/rapier3d-compat';
import {Vector3} from 'three';
registerHooks({resolve(s,c,next){return next(c.parentURL?.includes('/src/')&&/^\.\.?\//.test(s)&&!s.endsWith('.ts')?s+'.ts':s,c);}});
const root='../src/mmdVrShowcase/';
const {createHomeCapsule}=await import(root+'movement/homeCapsule.ts'),{addHomeTerrainSolids}=await import(root+'movement/homeTerrainSolids.ts');
const {createTraveller,surfaceStep,transport}=await import(root+'movement/planetTravel.ts');
const {stickAxis}=await import(root+'movement/controllerInput.ts'),{WALK_SPEED}=await import(root+'settings/mmdVrQuality.ts');
await Rapier.init();
const world=new Rapier.World({x:0,y:0,z:0});addHomeTerrainSolids(Rapier,world);
const d=createHomeCapsule(Rapier,world,()=>WALK_SPEED.normal),eye=new Vector3(0,1.65,0),last=new Vector3(),travel=new Vector3(),noop=()=>{};
let steps=0,seconds=0,casts=0;
const step=world.step.bind(world),cast=world.castShape.bind(world);
world.step=(...args)=>{steps++;seconds+=world.timestep;return step(...args)};
world.castShape=(...args)=>{casts++;return cast(...args)};
function run(native,rate,raw){
  const s=createTraveller();transport(s);if(native)d.seed(s);
  let metres=0,tail=0,us=0;steps=casts=seconds=0;
  for(let i=0;i<2*rate;i++){
    last.copy(s.foot);s.dir.set(0,0,-1).applyQuaternion(s.basis);const x=stickAxis(raw),start=performance.now();
    if(native)d.step(s,1/rate,x,0,eye,noop);
    else surfaceStep(s,travel.crossVectors(s.dir,s.up).multiplyScalar(x),WALK_SPEED.normal,1/rate,false,noop,1.745);
    us+=(performance.now()-start)*1000;const dist=s.foot.distanceTo(last);metres+=dist;if(i>=rate)tail+=dist;
  }
  const ticks=steps,queries=casts;assert(!native||Math.abs(seconds-2)<1e-6,'physics elapsed time');
  assert(s.grounded);last.copy(s.foot);
  if(native){for(let j=0;j<rate;j++)d.step(s,1/rate,0,0,eye,noop);d.stop();for(let j=0;j<rate;j++)d.step(s,1/rate,1,0,eye,noop);}
  else for(let j=0;j<rate;j++)surfaceStep(s,travel.set(0,0,0),2.4,1/rate,false,noop,1.745);
  assert(s.foot.distanceTo(last)<1e-6&&ticks===steps&&queries===casts,'idle/parked work or drift');
  return {backend:native?'Rapier':'JS',rate,raw,metres,tail,ticks,queries,usFrame:us/(2*rate)};
}
try{
  console.log(JSON.stringify({node:process.version,rapier:Rapier.version(),cpu:os.cpus()[0].model,flags:process.execArgv}));
  const rates=[20,36,72,90,120],rows=[];
  for(let i=0;i<16;i++)run(i%2===0,90,i%4<2?.25:1); // warm both adapters & WASM before the timing grid
  for(const native of [true,false])for(const rate of rates)for(const raw of [.25,1]){
    run(native,rate,raw);const samples=Array.from({length:5},()=>run(native,rate,raw));
    const r=samples.toSorted((a,b)=>a.usFrame-b.usFrame)[2];rows.push(r);
    assert(Math.abs(r.tail-WALK_SPEED.normal*stickAxis(raw))<.075,'steady sole speed');
  }
  for(const raw of [.25,1]){const measured=rows.filter(r=>r.raw===raw).map(r=>r.tail);assert(Math.max(...measured)-Math.min(...measured)<.035);}
  console.table(rows.map(({metres,tail,usFrame,...r})=>({...r,first2sM:+metres.toFixed(4),last1sM:+tail.toFixed(4),usFrame:+usFrame.toFixed(2)})));
}finally{d.dispose();world.free();}
