// Replay the measured binocular midpoint and XR frame. No renderer or WASM.
// node scripts/verify-planet-stance.mjs [path to capture-free-capture.json]
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registerHooks} from 'node:module';
import {Quaternion,Vector3} from 'three';
registerHooks({resolve(s,c,next){return next(c.parentURL?.includes('/src/')&&s.startsWith('.')&&!/\.[a-z]+$/i.test(s)?s+'.ts':s,c);}});
const {lanes}=await import('../src/mmdVrShowcase/scenery/planet/windAtlas.ts');
const {alignPlanetStance,fitPlanetLift}=await import('../src/mmdVrShowcase/movement/planetStance.ts');
const {altitude,shellRadius}=await import('../src/mmdVrShowcase/movement/orbitalSurfaces.ts');
const {moonWalk}=await import('../src/mmdVrShowcase/movement/moonWalk.ts');
const {createTraveller,transport}=await import('../src/mmdVrShowcase/movement/planetTravel.ts');
const glaze=lanes.find(l=>l.moon.id==='glaze').moon;
const row=JSON.parse(readFileSync(process.argv[2]??'local-review/verification/continuous-horizon/capture-free-capture.json','utf8')).at(-1);
const empty=()=>{},north=new Vector3(0,1,0),raw=new Vector3(...row.eye),axis=north.clone().applyQuaternion(new Quaternion(...row.rig));
const height=raw.clone().sub(new Vector3(...row.foot)).dot(axis),tracked=new Vector3(0,height,0);
const normal=raw.clone().sub(glaze.centre).normalize();
const sole=glaze.centre.clone().addScaledVector(normal,shellRadius(glaze,normal.x,normal.y,normal.z));
const off=raw.clone().sub(sole);
const initial=altitude(glaze,raw),unchecked=altitude(glaze,raw.clone().addScaledVector(axis,.2));
assert(initial>.114&&initial<.117&&unchecked<-.05,'not the recorded head-first capture');
const lift1=fitPlanetLift(glaze,sole,axis,off,height,0,.1,empty),lift2=fitPlanetLift(glaze,sole,axis,off,height,lift1,.2,empty);
const admitted=altitude(glaze,raw.clone().addScaledVector(axis,lift2));assert(admitted>=.115-.0003);

// Stand at the reviewed return-board foot. Transport the retained attitude
// and seat from the capture; every direction starts from an independent copy.
const trap=new Vector3(8.553291,25.382072,-30.578724),up=trap.clone().sub(glaze.centre).normalize();
const carry=new Quaternion().setFromUnitVectors(normal,up),right=new Vector3(1,0,0).projectOnPlane(up).normalize();
function trial(i,force){
  const s={...createTraveller(),display:carry.clone().multiply(new Quaternion(...row.rig)),viewUp:axis.clone().applyQuaternion(carry),seat:new Vector3(),groundTilt:new Quaternion()};
  s.foot.copy(trap);transport(s,glaze.centre);s.groundTilt.copy(s.basis).invert().multiply(s.display);
  s.seat.copy(off).applyQuaternion(carry).applyQuaternion(s.display.clone().invert()).sub(tracked);
  assert.equal(alignPlanetStance(glaze,s,tracked,0,empty),false);
  if(force){s.groundTilt.identity();s.seat.set(0,0,0);} // old unconditional Y
  const dir=right.clone().applyAxisAngle(up,2*Math.PI*i/32);
  for(let j=1;j<=30;j++){
    s.display.multiplyQuaternions(s.basis,s.groundTilt);s.viewUp.copy(north).applyQuaternion(s.display);
    moonWalk(glaze,s,dir,2.4,1/90,false,shellRadius,tracked.clone().add(s.seat).applyQuaternion(s.display),s.viewUp,height);
    dir.applyQuaternion(s.arc);
  }
  const before=s.foot.clone(),aligned=alignPlanetStance(glaze,s,tracked,0,empty);
  if(aligned){assert.equal(s.foot.distanceTo(before),0);assert.equal(s.seat.lengthSq(),0);assert(s.viewUp.dot(s.up)>1-1e-10);}
  return {direction:i,metres:s.foot.distanceTo(trap),aligned};
}
const forced=Array.from({length:32},(_,i)=>trial(i,true)),retained=Array.from({length:32},(_,i)=>trial(i,false));
const moving=rows=>rows.filter(r=>r.metres>.001).length;
assert.equal(moving(forced),0);assert(moving(retained)>0);assert(retained.some(r=>r.metres>.4&&r.aligned));
console.log(JSON.stringify({frame:row.frame,trackedHeight:height,eyeGapM:{initial,unchecked,admitted},appliedM:[lift1,lift2],
  directions:32,oldMoving:moving(forced),newMoving:moving(retained),newAlignedAtEnd:retained.filter(r=>r.aligned).length,best:retained.reduce((a,b)=>a.metres>b.metres?a:b)},null,2));
