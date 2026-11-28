import {expect,it} from 'vitest';
// @ts-expect-error WebGPU renderer modules live outside the WebGL entry graph.
import {recordFloorPerformance} from '../../../scripts/webgpu-actor/floorPerformance.js';
import {useMmdVrStore} from '../mmdVrStore';
import {useRenderDiagnostics} from './renderDiagnostics';
import {beginPerformanceAttempt,useLastPerformanceReport} from './performanceReport';

it('reports mounted assets, visible actor modes and actual WebGPU samples independently of entry hints',()=>{
  const prior=useMmdVrStore.getState(),requested={frameRate:'120 Hz',antialias:true,framebufferScale:.85,foveation:1};
  const recording=recordFloorPerformance(0,requested);
  const texture={},output={texture:{}};
  const colors={msaaTextures:[{sampleCount:4},{sampleCount:4}],texture:{sampleCount:1}};
  const renderer={needsFrameBufferTarget:true,_frameBufferTargets:new Map([[output,{texture}]]),getOutputRenderTarget:()=>output,
    backend:{has:(t:object)=>t===texture,get:()=>colors},xr:{getCamera:()=>({cameras:[{viewport:{z:386,w:384}},{viewport:{z:386,w:384}}]})},
    info:{render:{drawCalls:45,triangles:1200},memory:{textures:10,geometries:5}},shadowMap:{enabled:true}};
  const layer={textureWidth:400,textureHeight:400};
  const frame={session:{renderState:{layers:[layer]},frameRate:72}},views=[{eye:'left'},{eye:'right'}];
  const actors=[{id:'A',mode:'gpu',style:'endfield',visible:true},{id:'B',mode:'bullet',style:'mmd',visible:true}];
  const backend={status:{actors}};
  const live=actors.map(a=>({...a,name:a.id,scale:1,rotationY:0}));
  try{
    useMmdVrStore.setState({models:live,modelCount:2,objects:[{...live[0],id:'chair'}],prefs:{...prior.prefs,scenery:'liveHouse'}});
    recording.begin();recording.draw(1,frame,views,renderer,null,'floor');
    const gpuPasses={status:'pending',stereoSceneMs:null as number|null};
    expect(recording.sampleDue(600)).toBe(false);expect(recording.sampleDue(1100)).toBe(true);
    recording.draw(1100,frame,views,renderer,backend,'floor',gpuPasses);
    expect(useRenderDiagnostics.getState().current).toMatchObject({requested,refreshRate:72,width:400,height:400,foveation:null,targetSamples:4,
      layerAntialias:null,contextAntialias:null});
    actors[0].visible=false;live[0].visible=false;colors.msaaTextures[0].sampleCount=1;
    // A pending repair may already own an attachment before the room publishes it.
    actors.push({id:'pending',mode:'gpu',style:'endfield',visible:true});
    recording.draw(2300,frame,views,renderer,backend,'floor');
    Object.assign(gpuPasses,{status:'read',stereoSceneMs:2.4}); // late map belongs to the earlier mixed cast
    expect(useRenderDiagnostics.getState().current?.targetSamples).toBeNull();
    actors[1].visible=false;live[1].visible=false;recording.draw(3400,frame,views,renderer,backend,'floor');
    recording.finish();const report=useLastPerformanceReport.getState().report!;
    expect(report).not.toHaveProperty('webgpuFirstUse');
    expect(report.eyeViewports.map(v=>[v.width,v.height])).toEqual([[386,384],[386,384]]);
    expect(report.windows.filter(w=>w.gpuPasses)).toEqual([expect.objectContaining({gpuFrameTimeMs:1100,actorStyle:'mixed',gpuPasses})]);
    expect(report.windows.map(w=>[w.scenery,w.models,w.objects,w.liveHouse,w.actorStyle,w.clothMode])).toEqual([
      ['floor',0,0,false,undefined,undefined],['liveHouse',2,1,true,'mixed','mixed'],
      ['liveHouse',2,1,true,'mmd','bullet'],['liveHouse',2,1,true,undefined,undefined],
    ]);
    recording.interrupt();expect(useRenderDiagnostics.getState().current).toBeNull();
    const next=recordFloorPerformance(5000,requested);
    try {
      next.begin();expect(useLastPerformanceReport.getState().report).toBeNull();
      next.draw(5010,frame,views,renderer,null,'floor');next.draw(5030,frame,views,renderer,null,'floor');
      const events=[{kind:'entry',startMs:0,toStereoSubmitWallMs:10,maxTrackedIntervalMs:20,threePipelineRequests:2,threePipelineCallWallMs:1}];
      next.finish({snapshot:()=>events});expect(useLastPerformanceReport.getState().report?.webgpuFirstUse).toEqual(events);
    } finally {next.dispose();}
  }finally{recording.dispose();beginPerformanceAttempt('webgpu');useMmdVrStore.setState(prior);}
});
