import test from 'node:test';
import assert from 'node:assert/strict';
import {createFloorGpuTiming} from './webgpu-actor/floorGpuTiming.js';

// Recording device: no shaders, browser, or GPU. Exercise the async window and
// descriptor contract with distinct per-pass values and a deliberately late map.
function fixture(supported=true) {
  globalThis.GPUBufferUsage ??= {QUERY_RESOLVE:512, COPY_SRC:4, COPY_DST:8, MAP_READ:1};
  globalThis.GPUMapMode ??= {READ:1};
  let mapping, count=0, maps=0, submits=0;
  const timings=new BigUint64Array(64), slots=[], resources=[];
  function resource(obj={}) { obj.destroy=()=>{obj.destroyed=true;}; resources.push(obj); return obj; }
  const device={features:new Set(supported?['timestamp-query']:[]),createQuerySet:()=>resource(),
    createBuffer:()=>resource({mapState:'unmapped',async mapAsync(){maps++;mapping=Promise.withResolvers();await mapping.promise;this.mapState='mapped';},
      getMappedRange:()=>timings.buffer.slice(0,count*8),unmap(){this.mapState='unmapped';}}),
    createCommandEncoder:()=>({resolveQuerySet(_,start,n){assert.equal(start,0);count=n;},copyBufferToBuffer(){},finish(){}}),
    queue:{submit(){submits++;}}};
  const output={}, target={}, camera={}, layers=[{},{}], data={layerDescriptors:layers,arrayCameraRenderStages:[]};
  function record(writes,ns) {
    if(!writes)return;
    const {beginningOfPassWriteIndex:a,endOfPassWriteIndex:b}=writes;
    assert.equal(b,a+1);assert(!slots.includes(a),'Duplicate GPU timestamp index');slots.push(a);
    timings[a]=1000000n;timings[b]=timings[a]+BigInt(ns);
  }
  const backend={device,get:()=>data,initTimestampQuery(_type,_uid,d){d.timestampWrites=undefined;},
    finishRender(){layers.forEach((layer,i)=>record(layer.timestampWrites,(i+1)*1e6));}};
  const renderer={backend,xr:{getCamera:()=>camera},_frameBufferTargets:new Map([[output,target]]),getOutputRenderTarget:()=>output};
  const clock=createFloorGpuTiming(renderer);
  function pass(ctx,type,ns){renderer._currentRenderContext=ctx;const desc={};backend.initTimestampQuery(type,'uid',desc);record(desc.timestampWrites,ns);}
  return {clock,renderer,device,resources,layers,data,get counts(){return {maps,submits};},
    scene(){backend.finishRender({camera,renderTarget:target});},
    output(i){pass({fullscreenPass:true,renderTarget:output,activeCubeFace:i,camera:{}},'render',2e6);},
    offscreen(){pass({fullscreenPass:true,renderTarget:{},activeCubeFace:0,camera:{}},'render',10e6);},
    compute(ns){pass(null,'compute',ns);},cloth(steps,ns){record(clock.clothPass(steps).timestampWrites,ns);},
    async complete(ok=true){if(ok)mapping.resolve();else mapping.reject(Error('map failed'));await new Promise(setImmediate);slots.length=0;}};
}

test('one async map covers distinct eyes, output, native cloth and Three compute of one sampled draw',async()=>{
  const f=fixture(), original=f.renderer.backend.finishRender;
  assert.deepEqual(f.resources,[]);assert.equal(f.clock.clothPass(1),undefined);
  const row=f.clock.begin(2);f.cloth(2,200000);f.cloth(1,250000);f.compute(30000);f.offscreen();f.scene();f.output(0);f.output(1);f.clock.end();
  assert.equal(f.renderer.backend.finishRender,original);assert(f.layers.every(l=>!l.timestampWrites));
  assert.equal(row.status,'pending');assert.equal(row.stereoSceneMs,null);
  const busy=f.clock.begin(2);assert.equal(busy.status,'missed');assert.equal(busy.clothSteps,null);f.clock.end();
  await f.complete();assert.deepEqual(row,{status:'read',clothSteps:3,clothMs:.45,threeComputeMs:.03,stereoSceneMs:3,stereoOutputMs:4});
  assert.deepEqual(f.counts,{maps:1,submits:1});assert.equal(busy.stereoSceneMs,null);
  // One missing output eye and a split scene cannot inherit the previous sample.
  const partial=f.clock.begin(2);f.data.arrayCameraRenderStages.push({});f.scene();f.output(0);f.clock.end();await f.complete();
  assert.deepEqual(partial,{status:'read',clothSteps:0,clothMs:null,threeComputeMs:null,stereoSceneMs:null,stereoOutputMs:null});
  f.clock.dispose();assert(f.resources.every(r=>r.destroyed));
});

test('tracking loss, map failure and re-entry on a reused renderer do not publish late results',async()=>{
  const f=fixture(), lost=f.clock.begin(2);f.scene();f.clock.end();f.clock.interrupt();await f.complete();
  assert.equal(lost.status,'missed');assert.equal(lost.stereoSceneMs,null);
  const failed=f.clock.begin(2);f.scene();f.clock.end();await f.complete(false);assert.equal(failed.status,'missed');
  const retired=f.clock.begin(2);f.scene();f.clock.end();f.clock.dispose();
  const next=createFloorGpuTiming(f.renderer);await f.complete();assert.equal(retired.status,'missed');assert.equal(retired.stereoSceneMs,null);
  const current=next.begin(2);f.scene();next.end();await f.complete();assert.equal(current.stereoSceneMs,3);next.dispose();
});

test('unsupported device incurs no GPU work and does not install descriptor hooks',()=>{
  const f=fixture(false), init=f.renderer.backend.initTimestampQuery;
  assert.equal(f.clock.begin(2).status,'unsupported');assert.equal(f.renderer.backend.initTimestampQuery,init);
  f.clock.end();f.clock.dispose();assert.deepEqual(f.resources,[]);assert.deepEqual(f.counts,{maps:0,submits:0});
});
