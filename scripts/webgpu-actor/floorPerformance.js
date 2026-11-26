import {beginPerformanceAttempt,createPerformanceRecording,publishPerformanceReport} from '../../src/mmdVrShowcase/diagnostics/performanceReport';
import {useMmdVrStore} from '../../src/mmdVrShowcase/mmdVrStore';

// Called after a tracked draw. Sample the display from Three's populated eye
// viewports; never take another subimage or use the room's clamped physics dt.
export function recordFloorPerformance(started,frameRate) {
  const requested={frameRate,antialias:false,framebufferScale:null,foveation:null};
  const recording=createPerformanceRecording(requested,started,'webgpu');
  let sampledAt,frames=0;
  return {
    begin(){beginPerformanceAttempt('webgpu');},
    draw(time,frame,views,renderer,backend) {
      const hz=frame.session.frameRate;
      recording.timestamp(time,hz);
      const state=useMmdVrStore.getState();
      recording.scene(state.prefs.scenery);
      recording.startupFrame(!!backend && !state.assetLoad.running && state.modelCount>0);
      const elapsed=time-sampledAt;
      ++frames;
      if(sampledAt!==undefined && elapsed<1000)return;
      recording.eyes(views,renderer.xr.getCamera().cameras);
      const layer=frame.session.renderState.layers?.[0],actor=backend?.status;
      recording.sample({requested,active:true,refreshRate:hz>0?hz:null,
        fps:elapsed>0?Math.round(1000*frames/elapsed):null,frameIntervalMs:elapsed>0?elapsed/frames:null,
        layer:'projection',width:layer?.textureWidth??null,height:layer?.textureHeight??null,
        layerAntialias:null,targetSamples:null,contextAntialias:null,foveation:layer?.fixedFoveation??null,
        drawCalls:renderer.info.render.drawCalls,triangles:renderer.info.render.triangles,
        textures:renderer.info.memory.textures,geometries:renderer.info.memory.geometries,modelUpdateCpuMs:null,modelUpdateCpuMaxMs:null},
      {scenery:state.prefs.scenery,models:actor?state.modelCount:0,objects:0,physics:!!actor&&state.physicsEnabled,playing:!!actor&&state.playing,
        liveHouse:false,shadows:renderer.shadowMap.enabled,actorStyle:actor?.style?.mode,clothMode:actor?.mode});
      sampledAt=time;frames=0;
    },
    interrupt(){recording.interrupt();sampledAt=undefined;frames=0;},
    finish(){const report=recording.finish();if(report)publishPerformanceReport(report);},
  };
}
