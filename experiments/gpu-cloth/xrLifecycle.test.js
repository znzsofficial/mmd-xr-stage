import test from 'node:test';
import assert from 'node:assert/strict';
import {clothXR} from './xrLifecycle.js';
import {recorder} from './report.js';

const tick=()=>new Promise(resolve=>setImmediate(resolve));
const pending=()=>Promise.withResolvers();
function session(){
  const s=Object.assign(new EventTarget(),{supportedFrameRates:[72],frameRate:90,visibilityState:'visible',ends:0,
    updateTargetFrameRate(){return pending().promise;},requestReferenceSpace:async()=>({}),updateRenderState(){},
    requestAnimationFrame(cb){s.next=cb;return 17;},cancelAnimationFrame(){s.next=null;},
    frame(views=['left','right']){const cb=s.next;assert.ok(cb,'XR RAF scheduled');cb(10,{session:s,getViewerPose:()=>views&&{views:views.map(eye=>({eye}))}});},
    end(){s.ends++;s.dispatchEvent(new Event('end'));return Promise.resolve();}});
  return s;
}
function fixture(overrides={}){
  const a=session(),b=session(),report=recorder(),calls=[],sofar=[a,b],actor=pending(),validation=[];
  const device={pushErrorScope(){},popErrorScope:()=>validation.shift()??Promise.resolve(null),queue:{submit(){calls.push('submit');}}};
  const hooks={receipts:report.xr,requestSession:(mode,init)=>{assert.equal(mode,'immersive-vr');assert.deepEqual(init.requiredFeatures,['webgpu','local-floor']);return Promise.resolve(sofar.shift());},
    makeBinding:()=>({getPreferredColorFormat:()=>'rgba8unorm',createProjectionLayer:()=>({destroy(){calls.push('layer-destroy');}})}),
    makeTargets:()=>({views:poses=>poses.map((_,i)=>({format:'rgba8unorm',depthFormat:'depth24plus',depthSource:'local',arrayLayer:i,viewport:{x:0,y:0,width:240,height:240}})),dispose(){calls.push('dispose');}}),
    prepareActor:()=>actor.promise,draw:({withActor,submit})=>{calls.push(withActor?'actor':'landmark');submit({finish:()=>({})});},
    acquired:()=>calls.push('acquired'),changed(){},returned:paused=>calls.push(paused?'resume':'already-screen'),trackingGap:()=>calls.push('gap'),...overrides};
  const xr=clothXR(hooks);return {xr,device,report,a,b,calls,actor,validation,enter:()=>xr.enter(device),last:()=>report.xr.attempts.at(-1)};
}

test('hanging rate negotiation: first tracked RAF submits both landmarks, even while actor compilation is pending',async()=>{
  const f=fixture();await f.enter();const r=f.last();assert.equal(r.rate72,'pending');assert.equal(r.phase,'awaiting-frame');
  f.a.visibilityState='hidden';f.a.frame();f.a.visibilityState='visible';f.a.frame(null);f.a.frame([]);
  assert.equal(r.frames.hidden,1);assert.equal(r.frames.noPose,1);assert.equal(r.frames.noViews,1);
  f.a.frame();await tick();f.a.frame();assert.equal(r.frames.landmarkOnly,2);assert.equal(r.frames.stereoSubmitted,2);assert.equal(r.frames.subimages,4);
  assert.equal(r.actorState,'preparing');assert.equal(r.lastViews[1].arrayLayer,1);assert.equal(r.lastViews[0].depthSource,'local');
  f.actor.resolve();await tick();f.a.frame();await tick();assert.equal(r.frames.withActor,1);assert.equal(r.frames.validationPassed,3);
  await f.a.end();assert.equal(r.endObserved,true);assert.equal(r.screenResumed,false);f.xr.screenSubmitted();assert.equal(r.screenResumed,true);
  assert.equal(f.report.rows.length,0);assert.equal(f.report.exportable,true);
});

test('short failed attempts survive actor changes; exported exceptions and rig fields cannot carry filenames',async()=>{
  const bad=Object.assign(Error('C:/private/reference.pmx'),{name:'secret.pmx'});
  const f=fixture({requestSession:()=>Promise.reject(bad)}),meta={kind:'screen',mode:'gpu'};
  for(let i=0;i<140;i++)f.report.add(meta,16,1,2);
  const before=JSON.stringify(f.report.rows);assert.ok(f.report.rows.length);
  for(let i=0;i<14;i++)await f.enter();
  assert.equal(f.report.xr.attempts.length,12);assert.equal(f.last().id,14);assert.equal(f.last().frames.callbacks,0);assert.deepEqual(f.last().error,{stage:'request',type:'Error'});
  assert.equal(JSON.stringify(f.report.rows),before);const out=f.report.export({name:'secret.pmx',particles:32},false);
  assert.equal(out.schema,2);assert.equal(out.rig.particles,32);assert.doesNotMatch(JSON.stringify(out),/private|pmx/i);
  f.report.clear();assert.equal(f.report.rows.length,0);assert.equal(f.report.exportable,true);
});

test('late request and reference-space completions cannot reclaim a newer session',async()=>{
  const first=pending(),f=fixture({requestSession:()=>first.promise});const starting=f.enter();f.xr.close();
  assert.equal(f.last().phase,'ended');first.resolve(f.a);await starting;assert.equal(f.a.ends,1);assert.deepEqual(f.calls,['already-screen']);

  const g=fixture(),ref=pending();g.a.requestReferenceSpace=()=>ref.promise;
  const old=g.enter();await tick();const oldReceipt=g.last();await g.a.end();await g.enter();ref.resolve({});await old;
  assert.equal(g.a.next,undefined);g.b.frame();assert.equal(g.last().frames.landmarkOnly,1);assert.equal(oldReceipt.frames.callbacks,0);
  assert.equal(g.calls.filter(v=>v==='dispose').length,1);
});

test('subimage failure or rejected end() retires immediately; no submit is inferred, stale callbacks do nothing',async()=>{
  const f=fixture({makeTargets:()=>({views(){throw Object.assign(Error('right/private.pmx'),{eyeIndex:1});},dispose(){}})});
  f.a.end=()=>Promise.reject(new DOMException('private','InvalidStateError'));await f.enter();const old=f.last(),late=f.a.next;f.a.frame();
  assert.equal(f.xr.busy,false);assert.equal(old.phase,'failed');assert.deepEqual(old.error,{stage:'subimage',type:'Error',eyeIndex:1});assert.equal(old.frames.submitted,0);
  await f.enter();late(11,{session:f.a});await tick();assert.equal(old.endError.type,'InvalidStateError');assert.equal(old.endObserved,false);
  assert.equal(f.xr.session,f.b);assert.equal(f.last().frames.callbacks,0);assert.equal(f.calls.filter(v=>v==='resume').length,1);
});

test('late actor or frame-scope failures stay with their generation, even after re-entry',async()=>{
  const f=fixture();await f.enter();const old=f.last(),gpuResult=pending();f.validation.push(gpuResult.promise);
  f.a.frame();await tick();await f.a.end();await f.enter();const latest=f.last();f.actor.reject(Error('actor private.pmx'));gpuResult.resolve({name:'GPUValidationError',message:'secret'});await tick();
  assert.deepEqual(old.validationError,{stage:'frame-validation',type:'GPUValidationError'});assert.equal(old.frames.validationPassed,0);
  assert.equal(latest.phase,'awaiting-frame');assert.equal(latest.error,null);
  f.b.frame();await tick();f.b.frame();assert.equal(latest.actorError.stage,'actor-prepare');assert.equal(latest.frames.landmarkOnly,2);assert.equal(latest.frames.withActor,0);
});

test('submit throws vs. submit returns then validation fails: separate evidence, both return to screen',async()=>{
  const f=fixture();f.device.queue.submit=()=>{throw new DOMException('private','OperationError');};await f.enter();f.a.frame();
  assert.deepEqual(f.last().error,{stage:'submit',type:'OperationError'});assert.equal(f.last().frames.submitted,0);assert.equal(f.a.ends,1);
  const g=fixture();await g.enter();g.validation.push(Promise.resolve({name:'GPUValidationError',message:'secret'}));g.a.frame();await tick();
  assert.equal(g.last().frames.submitted,1);assert.equal(g.last().frames.validationPassed,0);assert.equal(g.last().error.stage,'frame-validation');
  assert.equal(g.xr.busy,false);g.xr.screenSubmitted();assert.equal(g.last().screenResumed,true);
});

test('only unsupported projection configuration retries without layer depth',async()=>{
  const options=[];const binding=name=>({getPreferredColorFormat:()=>'bgra8unorm',createProjectionLayer(opts){options.push(opts);if(opts.depthStencilFormat)throw new DOMException('layer',name);return {};}});
  const f=fixture({makeBinding:()=>binding('NotSupportedError')});await f.enter();f.a.frame();assert.equal(f.last().frames.landmarkOnly,1);
  assert.deepEqual(options,[{colorFormat:'bgra8unorm',depthStencilFormat:'depth24plus'},{colorFormat:'bgra8unorm'}]);options.length=0;
  const g=fixture({makeBinding:()=>binding('InvalidStateError')});await g.enter();assert.equal(options.length,1);assert.equal(g.last().error.stage,'layer');assert.equal(g.a.ends,1);
});
