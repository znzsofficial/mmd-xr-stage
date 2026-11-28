import {expect,it,vi} from 'vitest';
// @ts-expect-error Renderer-only modules stay outside the WebGL import graph.
import {recordFloorFirstUse} from '../../../scripts/webgpu-actor/floorFirstUse.js';
// @ts-expect-error Exercise the real choice and decoder lifetime without a GPU.
import {createActorStyle} from '../../../scripts/webgpu-actor/actorStyle.js';

function setup(){
  let now=100;
  const target={texture:{}},views=[{eye:'left'},{eye:'right'}];
  const layers=[{baseArrayLayer:1},{baseArrayLayer:0}];
  const backend={get:()=>({externalTexture:true,xrViewDescriptors:layers}),
    createRenderPipeline(){now+=3;},createComputePipeline(){now+=2;},finishRender(_ctx:object){now+=1;}};
  const renderer={backend,getOutputRenderTarget:()=>target};
  const original={...backend},trace=recordFloorFirstUse(renderer,now,()=>now);
  const eye=(index:number,dest:object=target)=>backend.finishRender({fullscreenPass:true,activeCubeFace:index,renderTarget:dest});
  return {backend,original,renderer,trace,eye,views,layers,clock:()=>now};
}

it('closes only on both final outputs in one tracked callback, including the gap delayed by that submission',()=>{
  const {trace,backend,original,eye,views,layers}=setup();
  trace.frame(100,views);backend.createRenderPipeline();eye(0);eye(0);eye(1,{});trace.endFrame();
  eye(1);trace.frame(115,views);eye(1);trace.endFrame();
  trace.frame(130,[views[0]]);eye(0);eye(1);trace.endFrame();
  layers[0].baseArrayLayer=0;trace.frame(140,views);eye(0);eye(1);trace.endFrame();layers[0].baseArrayLayer=1;
  expect(trace.snapshot()).toEqual([]);
  trace.frame(145,views);backend.createComputePipeline();eye(1);eye(0);trace.endFrame();
  trace.frame(445,views);trace.endFrame();
  expect(trace.snapshot()).toEqual([{kind:'entry',startMs:0,maxTrackedIntervalMs:300,toStereoSubmitWallMs:16,
    threePipelineRequests:2,threePipelineCallWallMs:5}]);
  trace.dispose();expect(backend).toEqual(original);
});

it('drops failed/retired loads, ignores the tracking break and starts again on a retained renderer',()=>{
  const {trace,renderer,backend,views,eye,clock}=setup();
  trace.frame(100,views);eye(0);eye(1);trace.endFrame();
  const stale=trace.model(),live=trace.model();
  trace.frame(113,views);stale.mark();stale.cancel();live.mark();eye(0);trace.interrupt();
  trace.frame(5100,views);live.mark();eye(1);eye(0);trace.endFrame();trace.interrupt();
  expect(trace.snapshot().map((s:{kind:string})=>s.kind)).toEqual(['entry','model']);
  expect(trace.snapshot()[1]).toMatchObject({maxTrackedIntervalMs:13,threePipelineRequests:0,toStereoSubmitWallMs:3});
  trace.dispose();
  const second=recordFloorFirstUse(renderer,clock(),clock);
  second.frame(6200,views);live.mark();backend.createRenderPipeline();eye(0);eye(1);second.endFrame();
  expect(second.snapshot()).toEqual([{kind:'entry',startMs:0,maxTrackedIntervalMs:null,toStereoSubmitWallMs:5,
    threePipelineRequests:1,threePipelineCallWallMs:3}]);second.dispose();
});

it('attributes a decode and a graph to their choice; a superseded decode never times the newer style',async()=>{
  const {trace,views,eye}=setup();let wall=0;
  const clock=vi.spyOn(performance,'now').mockImplementation(()=>wall);
  let done!:()=>void;
  const load=()=>new Promise(resolve=>{done=()=>resolve({cloth:new Map(),face:new Map()});});
  const adapter={prepareStyle:()=>{wall+=7;return true;},setStyle:()=>true};
  const makeStyle=()=>createActorStyle({}, {}, {hasBase:true,inputs:[{}],hybridSlots:{}},adapter,()=>{},load,trace);
  const style=makeStyle();
  const draw=(time:number)=>{trace.frame(time,views);style.frame();eye(0);eye(1);trace.endFrame();};
  try {
    draw(0);style.choose('endfield');wall=19;done();await Promise.resolve();draw(20);
    style.choose('mmd');draw(40);style.choose('endfield');draw(60);
    expect(trace.snapshot().slice(1)).toMatchObject([
      {mode:'endfield',maps:'load',mapLoadWallMs:19,prepareStyleWallMs:7,repeatPrepareStyle:false},
      {mode:'mmd'}, {mode:'endfield',maps:'cached',prepareStyleWallMs:7,repeatPrepareStyle:true}]);
    const old=makeStyle();old.choose('endfield');old.choose('strinova');old.dispose();done();await Promise.resolve();draw(80);
    expect(trace.snapshot()).toHaveLength(4);
  } finally {style.dispose();trace.dispose();clock.mockRestore();}
});
