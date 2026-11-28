// Installed before the game imports Three. Timings are browser wall clocks,
// including JS/native API and driver scheduling, never GPU compiler timestamps.
exports.install = function install() {
  const events = [], sources = new Map(), pipelineIds = new WeakMap(), ids = new WeakMap();
  const encoderSlices = new WeakMap(), commandSlices = new WeakMap(), viewSlice = new WeakMap();
  const dispatches = new Map();
  let nextPipeline = 0, nextId = 0, projection, submitted = new Set(), start, priorEnd, nextInterval, drawIds = new Set();
  let phase, release, completed, requested, maskOmit;
  const trackedBuffers=new WeakMap(),owned={};

  function intercept(type, method, fn) {
    const native = type.prototype[method];
    type.prototype[method] = function (...args) { return fn.call(this, native, ...args); };
  }
  for (const method of ['createShaderModule', 'createRenderPipeline', 'createRenderPipelineAsync', 'createComputePipeline', 'createComputePipelineAsync']) {
    intercept(GPUDevice, method, function (native, desc) {
      const t = performance.now(), value = native.call(this, desc), returned = performance.now();
      const e = {method, at:t, js:returned-t, entry:desc.compute?.entryPoint};
      if (method === 'createShaderModule') {
        if (!sources.has(desc.code)) sources.set(desc.code, sources.size+1);
        e.source = sources.get(desc.code); ids.set(value, ++nextId); e.module = nextId;
      } else {
        const record = pipeline => {
          if (!pipelineIds.has(pipeline)) pipelineIds.set(pipeline, ++nextPipeline);
          e.pipeline = pipelineIds.get(pipeline); e.done = performance.now();
        };
        if (method.endsWith('Async')) value.then(record, () => { e.error = true; }); else record(value);
      }
      events.push(e); return value;
    });
  }
  intercept(GPUShaderModule, 'getCompilationInfo', function(native) {
    const at = performance.now(), result = native.call(this), e = {method:'getCompilationInfo', at, module:ids.get(this), js:performance.now()-at};
    events.push(e); result.then(() => {e.done=performance.now();}, () => {e.error=true;}); return result;
  });
  // Record the *submitted* final output attachment views, not just two
  // getViewSubImage calls. Diagnostic copy commands have no render passes.
  intercept(GPUTexture, 'createView', function(native, desc) {
    const value = native.call(this, desc);
    if (this === projection) viewSlice.set(value, desc?.baseArrayLayer ?? 0);
    return value;
  });
  intercept(GPUCommandEncoder, 'beginRenderPass', function(native, desc) {
    const pass = native.call(this, desc);
    for (const a of desc.colorAttachments) {
      const layer = viewSlice.get(a?.resolveTarget ?? a?.view);
      if (layer !== undefined) {
        if (!encoderSlices.has(this)) encoderSlices.set(this, []);
        encoderSlices.get(this).push(layer);
      }
    }
    return pass;
  });
  intercept(GPUCommandEncoder, 'finish', function(native, desc) {
    const value = native.call(this, desc); if (encoderSlices.has(this)) commandSlices.set(value, encoderSlices.get(this)); return value;
  });
  intercept(GPUQueue, 'submit', function(native, buffers) {
    const value = native.call(this, buffers);
    for (const cmd of buffers) for (const i of commandSlices.get(cmd) ?? []) submitted.add(i);
    return value;
  });
  intercept(GPUComputePassEncoder, 'setPipeline', function(native, pipeline) {
    const id = pipelineIds.get(pipeline); if (id !== undefined) dispatches.set(id,(dispatches.get(id)??0)+1);
    return native.call(this, pipeline);
  });
  intercept(GPUDevice,'createBuffer',function(native,desc){
    const b=native.call(this,desc);
    if(['hand surface skin palette','solver scratch','previous','hand face responses'].includes(desc.label)){
      trackedBuffers.set(b,desc.label);owned[desc.label]=(owned[desc.label]??0)+1;
    }
    return b;
  });
  intercept(GPUBuffer,'destroy',function(native){
    const label=trackedBuffers.get(this);if(label){owned[label]--;trackedBuffers.delete(this);}
    return native.call(this);
  });
  const binding = window.XRGPUBinding;
  window.XRGPUBinding = class extends binding {
    createProjectionLayer(init) { const layer=super.createProjectionLayer(init); projection=layer.tex; return layer; }
  };
  // This is the simulated device's event delivery; the game still receives
  // the exact pointer events from its configured controller profile.
  const request = navigator.xr.requestSession.bind(navigator.xr);
  navigator.xr.requestSession = async (...args) => {
    const s=await request(...args), dispatch=s.dispatchEvent.bind(s);
    s.dispatchEvent=event=>{
      if (requested && event.type==='select') {
        release = {at:performance.now(), frame:s.stats.frames, offset:events.length}; phase = requested; requested = null;
      }
      return dispatch(event);
    };
    return s;
  };
  window.compileProbe = {
    observeRenderer() {
      const {gl} = gameTargets.floorState(), original = gl.getRenderObjectFunction() ?? gl.renderObject;
      gl.setRenderObjectFunction(function(object,...args) {
        const id=object.userData.mmdModelId;
        if (id && object.isMesh) {
          if (id===maskOmit) return;
          drawIds.add(id);
        }
        return original.call(gl,object,...args);
      });
    },
    enter() {
      const now=performance.now(),gap=now-start;
      if(nextInterval){nextInterval(gap);nextInterval=null;}
      if(phase)phase.maxTrackedIntervalMs=Math.max(phase.maxTrackedIntervalMs??0,gap);
      start=now;submitted=new Set();drawIds=new Set();
    },
    arm(spec) { if (phase||requested) throw Error('Overlapping input take'); requested={...spec, frames:[]}; completed=null; },
    after(session) {
      const end=performance.now();
      if (phase && session.stats.frames>release.frame) {
        const s=stageProbe.read(), actors=s.actor?.actors??[], both=submitted.has(0)&&submitted.has(1);
        const row={frame:session.stats.frames, sinceRelease:end-release.at, work:end-start, interval:end-Math.max(release.at,priorEnd), both, drawIds:[...drawIds]};
        phase.frames.push(row);
        if (drawIds.size===phase.count && both && !phase.firstDraw) phase.firstDraw=row;
        const ready = s.ready && actors.length===phase.count && actors.every(a=>a.visible&&drawIds.has(a.id)) &&
          (phase.mode ? actors.every(a=>a.style===(a.id===phase.id?phase.mode:'mmd')) : actors.every(a=>a.mode==='gpu'));
        if (both && ready) {
          const {label}=phase;
          const record={...phase,release,firstReady:row,events:events.slice(release.offset),copyAt:end};
          const promise=session.copyEyes();
          (this.images??={})[label]=promise;
          const following=new Promise(ok=>{nextInterval=ok;});
          completed=Promise.all([promise.then(pair=>({readbackWallMs:performance.now()-release.at,extent:[pair[0].width,pair[0].height]})),following])
            .then(([image,gap])=>({...record,...image,maxTrackedIntervalMs:Math.max(record.maxTrackedIntervalMs??0,gap)}));
          phase=null;
        }
      }
      priorEnd=end;
    },
    pending() { return !!completed; }, report() { return completed; },
    debug() {return {requested:requested?.label,phase:phase?.label,last:phase?.frames.slice(-1),submitted:[...submitted],drawIds:[...drawIds]};},
    async capture(label,omit) {
      if (labFixture.take) throw Error('Another take is active');
      maskOmit=omit;
      try {
        const data=await new Promise(ok=>{labFixture.take={inputs(){this.time=performance.now();},afterDraw(s){labFixture.take=null;ok(s.copyEyes());}};});
        (this.images??={})[label]=data;
      } finally { maskOmit=undefined; labFixture.take=null; }
    },
    async compare({base,omit,a,b}) {
      const [full,missing,old,next]=await Promise.all([base,omit,a,b].map(k=>this.images[k]));
      return full.map((ref,eye)=>{
        const peak=(p,q,k)=>Math.max(...[0,1,2].map(c=>Math.abs(p.data[k+c]-q.data[k+c])));
        let pixels=0,changed=0,nonzero=0,l1=0;
        for(let k=0;k<ref.data.length;k+=4){
          if(peak(ref,missing[eye],k)<15)continue;
          pixels++; const d=peak(old[eye],next[eye],k); if(d>6)changed++; if(d)nonzero++;
          for(let c=0;c<3;c++)l1+=Math.abs(old[eye].data[k+c]-next[eye].data[k+c]);
        }
        return {pixels,changed,nonzero,l1};
      });
    },
    buffers() {return {...owned};},
    totals() { return {events, dispatches:Object.fromEntries(dispatches)}; },
  };
};
