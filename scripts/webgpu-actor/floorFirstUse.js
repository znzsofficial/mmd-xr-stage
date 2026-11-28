import {createPlacementWork} from '../../src/mmdVrShowcase/diagnostics/placementWork';

// Opt-in, per XR session. Count Three's cache misses at the r187 backend
// boundary, not live shader modules, device-wide native calls or GPU time.
export function recordFloorFirstUse(renderer, entryStart, now = () => performance.now()) {
  const backend = renderer.backend, pending = new Set(), ready = new Set(), reports = [];
  let requests = 0, callMs = 0, previous, stereoFrame = false, eyeMask = 0;
  const followingInterval = new Set();
  function begin(kind, start = now()) {
    const report = {kind, startMs:start-entryStart, maxTrackedIntervalMs:null};
    const job = {report, start, requests, callMs};
    pending.add(job);
    return {report, mark(){if (pending.has(job)) ready.add(job);}, cancel(){pending.delete(job);ready.delete(job);}};
  }
  const entry = begin('entry',entryStart);
  const restore = [];
  for (const name of ['createRenderPipeline','createComputePipeline']) {
    const original = backend[name];
    backend[name] = function(...args) {
      ++requests;
      const at = now();
      try { return original.apply(this,args); }
      finally { callMs += now()-at; }
    };
    restore.push(()=>{backend[name]=original;});
  }
  // r187 finishRender submits the encoder before returning. Its final
  // color conversion draws one mono quad to each ordinal of the XR target.
  const finish = backend.finishRender;
  backend.finishRender = function(ctx) {
    const value = finish.call(this,ctx);
    if (stereoFrame && ready.size && ctx.fullscreenPass && !ctx.camera?.isArrayCamera &&
        ctx.renderTarget && ctx.renderTarget === renderer.getOutputRenderTarget() && (ctx.activeCubeFace===0 || ctx.activeCubeFace===1)) {
      eyeMask |= 1 << ctx.activeCubeFace;
      if (eyeMask===3) {
        const output = this.get(ctx.renderTarget.texture);
        const layers = output.xrViewDescriptors;
        if (!output.externalTexture || layers?.length !== 2 || !layers[0] || !layers[1] ||
            (layers[0].baseArrayLayer ?? 0) === (layers[1].baseArrayLayer ?? 0)) return value;
        const at = now();
        for (const job of ready) {
          const {report} = job;
          report.toStereoSubmitWallMs = at-job.start;
          report.threePipelineRequests = requests-job.requests;
          report.threePipelineCallWallMs = callMs-job.callMs;
          if (reports.length===120) reports.shift();
          reports.push(report); followingInterval.add(report); pending.delete(job);
        }
        ready.clear();
      }
    }
    return value;
  };
  return {
    model(work = createPlacementWork()) { return {...begin('model'),work}; },
    style(mode) { const job=begin('style');job.report.mode=mode;return job; },
    frame(time,views) {
      const gap = time-previous;
      if (Number.isFinite(gap) && gap>0) {
        const update = report=>{ report.maxTrackedIntervalMs=Math.max(report.maxTrackedIntervalMs??0,gap); };
        for (const {report} of pending) update(report);
        // A block during submission delays the next callback, not this one's timestamp.
        for (const report of followingInterval) update(report);
      }
      followingInterval.clear();ready.clear();eyeMask=0;previous=time;
      stereoFrame = views.length===2 && views.some(v=>v.eye==='left') && views.some(v=>v.eye==='right');
      entry.mark();
    },
    endFrame() {stereoFrame=false;},
    interrupt() {previous=undefined;stereoFrame=false;ready.clear();followingInterval.clear();},
    snapshot:()=>reports.map(report=>({...report})),
    dispose() {backend.finishRender=finish;for (const undo of restore) undo();pending.clear();ready.clear();followingInterval.clear();},
  };
}
