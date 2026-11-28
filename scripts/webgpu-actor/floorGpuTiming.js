// One sparse sample, one queue submission for its timestamps, one async map.
// Keep the result with the window that actually submitted the work. Nothing
// here requests a device, a subimage, a queue drain or a second scene draw.
const maxPasses = 32;

function result(status) {
  return {status, clothSteps:status === 'pending' ? 0 : null, clothMs:null, threeComputeMs:null, stereoSceneMs:null, stereoOutputMs:null};
}

// r187's normal timer copies ONE timestamp pair into every ArrayCamera layer
// descriptor. Its pooled total can also return lastValue without a new read.
// Use its descriptor hook for mono output and TSL compute, and independent
// pairs on the two actual layer passes. No changes to the device prototype.
export function createFloorGpuTiming(renderer) {
  const backend = renderer.backend, device = backend.device;
  let unavailable = !device?.features.has('timestamp-query') ? 'unsupported' : null;
  if (!unavailable && (backend.trackTimestamp || typeof backend.initTimestampQuery !== 'function' ||
      typeof backend.finishRender !== 'function')) unavailable = 'unavailable';
  let querySet, resolveBuffer, readBuffer, active, pending, disposed = false;

  function release() {
    querySet?.destroy(); resolveBuffer?.destroy(); readBuffer?.destroy();
  }
  function allocate() {
    const size = maxPasses * 16;
    querySet = device.createQuerySet({type:'timestamp', count:2 * maxPasses});
    resolveBuffer = device.createBuffer({size, usage:GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC});
    readBuffer = device.createBuffer({size, usage:GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ});
  }
  function writes(sample, group, eye) {
    if (sample.passes.length >= maxPasses) { sample.incomplete.add(group); return; }
    const offset = sample.passes.length * 2;
    sample.passes.push({group, eye});
    return {querySet, beginningOfPassWriteIndex:offset, endOfPassWriteIndex:offset+1};
  }
  function bind(sample) {
    const init = backend.initTimestampQuery, finish = backend.finishRender;
    backend.initTimestampQuery = function(type, uid, descriptor) {
      init.call(this, type, uid, descriptor);
      if (type === 'compute') descriptor.timestampWrites = writes(sample, 'threeComputeMs');
      const ctx = renderer._currentRenderContext;
      if (type === 'render' && ctx?.fullscreenPass && !ctx.camera?.isArrayCamera &&
          ctx.renderTarget && ctx.renderTarget === renderer.getOutputRenderTarget()) {
        descriptor.timestampWrites = writes(sample, 'stereoOutputMs', ctx.activeCubeFace);
      }
    };
    backend.finishRender = function(ctx) {
      const output = renderer.getOutputRenderTarget();
      if (!output || ctx.camera !== renderer.xr.getCamera() ||
          (ctx.renderTarget !== output && ctx.renderTarget !== renderer._frameBufferTargets.get(output))) return finish.call(this, ctx);
      const {layerDescriptors:layers, arrayCameraRenderStages:stages} = this.get(ctx);
      // A framebuffer copy splits an eye into multiple render stages, which
      // reuse its descriptor. Don't write the same query twice or report a
      // partial result for that scene. Shadows/offscreen draws are separate.
      if (sample.eyes !== 2 || layers?.length !== 2 || stages?.length !== 0) {
        sample.incomplete.add('stereoSceneMs'); return finish.call(this, ctx);
      }
      for (const [eye, layer] of layers.entries()) layer.timestampWrites = writes(sample, 'stereoSceneMs', eye);
      try { return finish.call(this, ctx); }
      finally { for (const layer of layers) layer.timestampWrites = undefined; }
    };
    return () => { backend.initTimestampQuery = init; backend.finishRender = finish; };
  }
  async function collect(sample) {
    try {
      const count = sample.passes.length * 2, bytes = count * 8;
      const encoder = device.createCommandEncoder({label:'XR sampled pass timestamps'});
      encoder.resolveQuerySet(querySet, 0, count, resolveBuffer, 0);
      encoder.copyBufferToBuffer(resolveBuffer, 0, readBuffer, 0, bytes);
      device.queue.submit([encoder.finish()]);
      await readBuffer.mapAsync(GPUMapMode.READ, 0, bytes);
      if (!disposed && sample.result.status === 'pending') {
        const times = new BigUint64Array(readBuffer.getMappedRange(0, bytes));
        const groups = new Map();
        for (const [i, {group, eye}] of sample.passes.entries()) {
          const start = times[2*i], end = times[2*i+1];
          if (!start || end < start) sample.incomplete.add(group);
          const sums = groups.get(group) ?? {ns:0n, eyes:[]};
          sums.ns += end - start;
          if (eye !== undefined) sums.eyes.push(eye);
          groups.set(group, sums);
        }
        for (const [group, {ns, eyes}] of groups) {
          if (sample.incomplete.has(group)) continue;
          if (group.startsWith('stereo') && (sample.eyes !== 2 || eyes.length !== 2 || !eyes.includes(0) || !eyes.includes(1))) continue;
          sample.result[group] = Number(ns) / 1e6;
        }
        sample.result.status = 'read';
      }
    } catch { if (sample.result.status === 'pending') sample.result.status = 'missed'; }
    finally {
      if (!disposed && readBuffer.mapState === 'mapped') readBuffer.unmap();
      pending = undefined;
    }
  }
  function stopSample() {
    if (active) { active.unbind(); active.result.status = 'missed'; active = undefined; }
    if (pending) pending.result.status = 'missed';
  }
  return {
    begin(eyes) {
      if (unavailable || disposed || pending) return result(unavailable ?? 'missed');
      if (!querySet) {
        try { allocate(); }
        catch { release(); unavailable = 'unavailable'; return result(unavailable); }
      }
      active = {eyes, passes:[], incomplete:new Set(), result:result('pending')};
      active.unbind = bind(active);
      return active.result;
    },
    clothPass(steps) {
      if (!active) return;
      active.result.clothSteps += steps;
      return {timestampWrites:writes(active, 'clothMs')};
    },
    end() {
      if (!active) return;
      const sample = active; active = undefined; sample.unbind();
      if (!sample.passes.length) { sample.result.status = 'missed'; return; }
      pending = sample; void collect(sample);
    },
    interrupt:stopSample,
    dispose() { disposed = true; stopSample(); release(); },
  };
}
