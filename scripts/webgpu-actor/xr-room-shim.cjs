// Install AFTER the cloth stereo shim, before importing Three. Keep its real
// projection texture, readback and reversed-slice implementation. Supply the
// additional WebXR session/pose fields that Three (unlike the raw lab) reads.
module.exports = function extendStereoShim() {
  const cfg = window.labFixture, request = navigator.xr.requestSession.bind(navigator.xr);
  cfg.adapters = [];
  const getAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
  navigator.gpu.requestAdapter = async options => {
    const a = await getAdapter(options), i = a?.info;
    cfg.adapters.push({ xrCompatible: options?.xrCompatible, vendor: i?.vendor, architecture: i?.architecture,
      description: i?.description, fallback: i?.isFallbackAdapter ?? a?.isFallbackAdapter });
    return a;
  };
  navigator.xr.requestSession = async (mode, init) => {
    if (!init.requiredFeatures?.includes('local-floor')) throw Error('Missing required local-floor');
    const s = await request(mode, init);
    const stats = s.stats = { layers: 0, frames: 0, submissions: 0, pending: 0, maxPending: 0, references: [] };
    s.enabledFeatures = [...init.requiredFeatures]; s.renderState = { depthNear: .05, depthFar: 30 };
    s.updateRenderState = patch => Object.assign(s.renderState, patch);
    s.requestReferenceSpace = async type => {
      stats.references.push(type); if (type !== 'local-floor') throw Error('Unexpected reference space'); return {};
    };
    const raf = s.requestAnimationFrame.bind(s);
    let reader;
    s.readNextDraw = () => new Promise((resolve, reject) => {
      if (reader) { reject(Error('Readback already queued')); return; }
      reader = resolve;
    });
    s.cancelAnimationFrame = id => { cancelAnimationFrame(id); stats.pending = 0; };
    s.requestAnimationFrame = fn => {
      stats.maxPending = Math.max(stats.maxPending, ++stats.pending);
      return raf((t, f) => {
        stats.pending--; stats.frames++; s.inFrame = true;
        const pose = f.getViewerPose(), before = stats.submissions;
        for (const v of pose?.views ?? []) {
          const m = v.transform.inverse.matrix.slice(); m[12] *= -1; m[13] *= -1;
          v.transform.matrix = m;
          // A finite WebGPU projection (clip-space Z in [0,1]). The lab's
          // infinite-far fixture doesn't exercise Three's frustum construction.
          const { depthNear: n, depthFar: z } = s.renderState;
          v.projectionMatrix[10] = z / (n-z); v.projectionMatrix[14] = z*n / (n-z);
        }
        f.getViewerPose = () => pose;
        try {
          fn(t, f);
          // Copy the FIRST submitted tracked frame before yielding to another
          // RAF or actor decode. Only the diagnostic copy/map is asynchronous.
           if (!s.first && pose && stats.submissions > before) s.first = s.capture(true);
           if (reader && pose && stats.submissions > before) { const done=reader; reader=null; done(s.capture()); }
        } finally { s.inFrame = false; }
      });
    };
    return s;
  };
  window.XRGPUBinding = class extends window.XRGPUBinding {
    constructor(s, device) {
      super(s, device);
      const submit = device.queue.submit.bind(device.queue);
      device.queue.submit = commands => {
        if (!s.readback) {
          if (!s.inFrame) throw Error('GPU queue.submit outside the owning XR frame');
          s.stats.submissions++;
        }
        return submit(commands);
      };
    }
    createProjectionLayer(init) {
      if (cfg.rejectLayer) throw new DOMException('injected layer failure', 'NotSupportedError');
      const layer = super.createProjectionLayer(init), s = this.s;
      s.stats.layers++; s.stats.colorFormat = init.colorFormat;
      const capture = s.capture;
      s.capture = reference => {
        if (!s.inFrame) throw Error('Diagnostic copy outside the owning XR frame');
        s.readback = true; try { return capture(reference); } finally { s.readback = false; }
      };
      return layer;
    }
    getViewSubImage(layer, view) {
      if (!this.s.inFrame || this.s.renderState.layers?.[0] !== layer) throw Error('Stale XR subimage');
      const image = super.getViewSubImage(layer, view), descriptor = image.getViewDescriptor();
      if (!cfg.reversed) descriptor.baseArrayLayer = view.i;
      (this.s.stats.slices ??= {})[view.eye] = descriptor.baseArrayLayer;
      return { ...image, getViewDescriptor: () => descriptor };
    }
  };
};
