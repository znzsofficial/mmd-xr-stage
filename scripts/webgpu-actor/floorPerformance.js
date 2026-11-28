import {beginPerformanceAttempt,createPerformanceRecording,publishPerformanceReport} from '../../src/mmdVrShowcase/diagnostics/performanceReport';
import {useMmdVrStore} from '../../src/mmdVrShowcase/mmdVrStore';
import {useBackpack} from '../../src/mmdVrShowcase/backpack/store';
import {useRenderDiagnostics} from '../../src/mmdVrShowcase/diagnostics/renderDiagnostics';
import {runtimeTiming} from '../../src/mmdVrShowcase/diagnostics/runtimeTiming';

function sceneSamples(renderer){
  // r187 resolves per-eye MSAA into a linear scene texture, THEN converts
  // into the single-sample projection texture. Inspect allocated attachments,
  // without creating a target, touching a subimage or inferring from the request.
  const output=renderer.getOutputRenderTarget();
  const target=renderer.needsFrameBufferTarget?renderer._frameBufferTargets.get(output):output;
  if(!target || !renderer.backend.has(target.texture))return null;
  const data=renderer.backend.get(target.texture);
  const samples=data.msaaTextures?.map(t=>t.sampleCount)??[data.msaaTexture?.sampleCount??data.texture?.sampleCount];
  return samples[0]>0 && samples.every(n=>n===samples[0])?samples[0]:null;
}

function sharedValue(actors,key){
  const first=actors[0]?.[key];
  return actors.every(actor=>actor[key]===first)?first:'mixed';
}

// Called after a tracked draw. Sample the display from Three's populated eye
// viewports; never take another subimage or use the room's clamped physics dt.
export function recordFloorPerformance(started,requested) {
  const recording=createPerformanceRecording(requested,started,'webgpu');
  let sampledAt,frames=0,lastPublished;
  const sampleDue=time=>sampledAt===undefined || time-sampledAt>=1000;
  function clearPublished(){
    if(lastPublished && useRenderDiagnostics.getState().current===lastPublished){
      useRenderDiagnostics.getState().set(null);runtimeTiming.readAndReset();
    }
    lastPublished=undefined;
  }
  return {
    begin(){beginPerformanceAttempt('webgpu');runtimeTiming.readAndReset();},
    sampleDue,
    draw(time,frame,views,renderer,backend,entryRoom,gpuPasses) {
      const hz=frame.session.frameRate;
      recording.timestamp(time,hz);
      const state=useMmdVrStore.getState();
      const scenery=backend?state.prefs.scenery:entryRoom;
      const models=backend?state.models.length:0,objects=backend?state.objects.length:0;
      recording.scene(scenery);
      recording.startupFrame(!state.assetLoad.running && models+objects>0);
      if(backend)recording.placementFrame(useBackpack.getState().lastCompletedPlacement);
      const elapsed=time-sampledAt;
      ++frames;
      if(!sampleDue(time))return;
      recording.eyes(views,renderer.xr.getCamera().cameras);
      const layer=frame.session.renderState.layers?.[0],cost=runtimeTiming.readAndReset();
      const visible=backend?state.models.filter(m=>m.visible):[];
      const attached=backend?.status.actors??[];
      const styles=visible.map(m=>attached.find(a=>a.id===m.id&&a.visible));
      const data={requested,active:true,refreshRate:Number.isFinite(hz)&&hz>0?hz:null,
        fps:elapsed>0?Math.round(1000*frames/elapsed):null,frameIntervalMs:elapsed>0?Math.round(10*elapsed/frames)/10:null,
        layer:layer?'projection':'unknown',width:layer?.textureWidth??null,height:layer?.textureHeight??null,
        layerAntialias:null,targetSamples:layer?sceneSamples(renderer):null,contextAntialias:null,
        foveation:Number.isFinite(layer?.fixedFoveation)?layer.fixedFoveation:null,
        drawCalls:renderer.info.render.drawCalls,triangles:renderer.info.render.triangles,
        textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,modelUpdateCpuMs:cost?.mean??null,modelUpdateCpuMaxMs:cost?.max??null,
        ...(cost?.physicsPoseWork && {physicsPoseWork:cost.physicsPoseWork}),...(cost?.bulletStepWork && {bulletStepWork:cost.bulletStepWork}),
        ...(cost?.skirtWork && {skirtWork:cost.skirtWork})};
      useRenderDiagnostics.getState().set(lastPublished=data);
      recording.sample(data,{scenery,models,objects,physics:!!backend&&state.physicsEnabled,playing:!!backend&&state.playing,
        liveHouse:scenery==='liveHouse',shadows:renderer.shadowMap.enabled,...(gpuPasses && {gpuPasses,gpuFrameTimeMs:time}),
        ...(styles.length>0&&styles.every(Boolean)&&{actorStyle:sharedValue(styles,'style'),clothMode:sharedValue(styles,'mode')})});
      sampledAt=time;frames=0;
    },
    interrupt(){
      recording.interrupt();sampledAt=undefined;frames=0;clearPublished();
    },
    finish(){const report=recording.finish();if(report)publishPerformanceReport(report);},
    dispose:clearPublished,
  };
}
