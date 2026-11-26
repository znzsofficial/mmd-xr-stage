// Install AFTER the cloth stereo shim, before importing Three. Keep its real
// projection texture, readback and reversed-slice implementation. Supply the
// additional WebXR session/pose fields that Three (unlike the raw lab) reads.
module.exports = function extendStereoShim() {
  const systemEvents=new EventTarget();
  for(const method of ['addEventListener','removeEventListener','dispatchEvent'])navigator.xr[method]=systemEvents[method].bind(systemEvents);
  // This display grants a WebGPU projection layer only. A browser's native
  // media-layer binding cannot be constructed with this simulated session.
  if (typeof XRMediaBinding!=='undefined') Object.defineProperty(window,'XRMediaBinding',{configurable:true,value:undefined});
  const cfg = window.labFixture, request = navigator.xr.requestSession.bind(navigator.xr);
  cfg.adapters = [];
  const getAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
  navigator.gpu.requestAdapter = async options => {
    const a = await getAdapter(options), i = a?.info;
    cfg.adapters.push({ xrCompatible: options?.xrCompatible, vendor: i?.vendor, architecture: i?.architecture,
      description: i?.description, fallback: i?.isFallbackAdapter ?? a?.isFallbackAdapter });
    return a;
  };
  // Build rigid transforms even on Chromium installations without native XR.
  // The -Z axis of targetRaySpace points at the requested reference-space point;
  // gripSpace remains an independent pose used by the real cloth/hand path.
  function rigid(p, q={x:0,y:0,z:0,w:1}) {
    const position={...p,w:1}, {x,y,z,w}=q, m=new DOMMatrix().translate(p.x,p.y,p.z);
    if (Math.hypot(x,y,z)>0) m.rotateAxisAngleSelf(x,y,z,2*Math.atan2(Math.hypot(x,y,z),w)*180/Math.PI);
    return {position,orientation:q,matrix:m.toFloat32Array(), get inverse() {
      const i=m.inverse();return rigid({x:i.m41,y:i.m42,z:i.m43},{x:-x,y:-y,z:-z,w});
    }};
  }
  function relative(t, base) {
    const i=base.inverse, a=i.orientation, b=t.orientation;
    const p=DOMMatrix.fromFloat32Array(i.matrix).transformPoint(t.position);
    return rigid({x:p.x,y:p.y,z:p.z},{x:a.w*b.x+a.x*b.w+a.y*b.z-a.z*b.y,
      y:a.w*b.y-a.x*b.z+a.y*b.w+a.z*b.x,z:a.w*b.z+a.x*b.y-a.y*b.x+a.z*b.w,w:a.w*b.w-a.x*b.x-a.y*b.y-a.z*b.z});
  }
  function aim(p, at) {
    if (!at) return rigid(p); // Level, so an idle ray cannot hit the ground.
    const x=at[0]-p.x,y=at[1]-p.y,z=at[2]-p.z,w=Math.hypot(x,y,z)-z,len=Math.hypot(y,x,w);
    if (!len) throw Error('Aim must not be at the origin or directly behind the controller');
    return rigid(p,{x:y/len,y:-x/len,z:0,w:w/len});
  }
  navigator.xr.requestSession = async (mode, init) => {
    if (!init.requiredFeatures?.includes('local-floor')) throw Error('Missing required local-floor');
    const s = await request(mode, init);
    const stats = s.stats = { layers: 0, frames: 0, submissions: 0, pending: 0, maxPending: 0, references: [] };
    s.enabledFeatures = [...init.requiredFeatures]; s.environmentBlendMode='opaque'; s.renderState = { depthNear: .05, depthFar: 30 };
    const floor=new EventTarget(), origin=rigid({x:0,y:0,z:0});
    const rays=new Map(), grips=new Set(); let nextSelect;
    for (const src of s.inputSources) {
      Object.assign(src,{profiles:['generic-trigger'],targetRayMode:'tracked-pointer',targetRaySpace:{handedness:src.handedness}});
      Object.assign(src.gamepad,{mapping:'xr-standard',id:'',index:-1,connected:true,axes:[0,0,0,0],hapticActuators:[],timestamp:0});
      for (const b of src.gamepad.buttons) Object.assign(b,{touched:false,value:0});
      grips.add(src.gripSpace);
    }
    s.aimRay=(side,at)=>{
      const src=s.inputSources.find(a=>a.handedness===side);
      rays.set(src.targetRaySpace,aim({x:side==='right'?.17:-.23,y:1.12,z:-.62},at));
    };
    for (const src of s.inputSources) s.aimRay(src.handedness,null);
    s.swapToHand=side=>{
      const i=s.inputSources.findIndex(src=>src.handedness===side),old=s.inputSources[i];
      const hand=new Map([['wrist',{name:'wrist',side}]]);
      for(const digit of ['thumb','index-finger','middle-finger','ring-finger','pinky-finger'])
        for(const bone of ['metacarpal','phalanx-proximal',...(digit==='thumb'?[]:['phalanx-intermediate']),'phalanx-distal','tip']){
          const name=`${digit}-${bone}`;hand.set(name,{name,side});
        }
      const next={hand,handedness:side,targetRaySpace:{handedness:side},targetRayMode:'tracked-pointer',profiles:['generic-hand-select']};
      s.inputSources[i]=next;grips.delete(old.gripSpace);rays.delete(old.targetRaySpace);s.aimRay(side,null);
      s.dispatchEvent(Object.assign(new Event('inputsourceschange'),{added:[next],removed:[old],session:s}));
    };
    s.queueSelect=(side,down)=>{
      const inputSource=s.inputSources.find(a=>a.handedness===side);
      if(nextSelect || inputSource.gamepad.buttons[0].pressed===down)throw Error('Duplicate XR trigger transition');
      nextSelect={inputSource,down};
    };
    stats.selectEvents=[];stats.targetRayReads={left:0,right:0};
    s.updateRenderState = patch => Object.assign(s.renderState, patch);
    s.requestReferenceSpace = async type => {
      stats.references.push(type); if (type !== 'local-floor') throw Error('Unexpected reference space'); return floor;
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
        const take = cfg.take; // Optional deterministic two-hand input replay.
        if(s.inputSources.some(src=>src.hand))f.getJointPose=()=>null;
        if (take) take.inputs(f,s,cfg);
        for(const src of s.inputSources)if(src.gamepad)src.gamepad.timestamp=t;
        f.fillPoses=(spaces,base,out)=>{let i=0;for(const j of spaces){const m=f.getJointPose(j,base)?.transform.matrix;if(!m)return false;out.set(m,i);i+=16;}return true;};
        // Hand takes override (or clear) getPose to replay grips. Preserve just
        // those grips, including null; they must never replace a tracked ray.
        const gripPose=f.getPose.bind(f);
        function world(space) {
          if(space===floor)return origin;
          if(rays.has(space)){stats.targetRayReads[space.handedness]++;return rays.get(space);}
          if(!grips.has(space))return null;
          const t=gripPose(space,floor)?.transform;
          return t && rigid(t.position,t.orientation);
        }
        f.getPose=(space,base=floor)=>{
          if(!pose)return null;
          const t=world(space);if(!t)return null;
          const ref=base===floor?origin:world(base);if(!ref)return null;
          return {emulatedPosition:false,transform:space===base?origin:ref===origin?t:relative(t,ref)};
        };
        for (const v of pose?.views ?? []) {
          const m=v.transform.inverse.matrix;
          v.transform=rigid({x:cfg.sameEye?0:-m[12],y:take?.eyeY??-m[13],z:take?.eyeZ??-m[14]});
          // A finite WebGPU projection (clip-space Z in [0,1]). The lab's
          // infinite-far fixture doesn't exercise Three's frustum construction.
          const { depthNear: n, depthFar: z } = s.renderState;
          v.projectionMatrix[10] = z / (n-z); v.projectionMatrix[14] = z*n / (n-z);
        }
        if(pose){const [l,r]=pose.views.map(v=>v.transform.position);pose.transform=rigid({x:(l.x+r.x)/2,y:l.y,z:l.z});pose.emulatedPosition=false;}
        f.getViewerPose = () => pose;
        try {
          const transition=pose && nextSelect;
          if(transition){nextSelect=null;const {inputSource,down}=transition;
            Object.assign(inputSource.gamepad.buttons[0],{pressed:down,touched:down,value:Number(down)});}
          fn(take ? take.time : t, f);
          // Dispatch WebXR session input after the real pointer sampled this
          // tracked pose. No DOM click, R3F event or backpack callback here.
          if(transition){const {inputSource,down}=transition;
            for(const type of down?['selectstart']:['select','selectend']){
              s.dispatchingInput=type;
              try {s.dispatchEvent(Object.assign(new Event(type),{inputSource,frame:f}));} finally {s.dispatchingInput=null;}
              stats.selectEvents.push({type,side:inputSource.handedness,frame:stats.frames});
            }
          }
          // Copy the FIRST submitted tracked frame before yielding to another
          // RAF or actor decode. Only the diagnostic copy/map is asynchronous.
          if (!s.first && pose && stats.submissions > before) s.first = s.capture(true);
          if (reader && pose && stats.submissions > before) { const done=reader; reader=null; done(s.capture()); }
          if (take && pose && stats.submissions > before) take.afterDraw(s);
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
      // Diagnostic-only snapshot of both FINAL color layers, never a solver
      // input. Encode the copy inside XR; map only our own buffer afterwards.
      s.copyEyes = () => {
        if (!s.inFrame) throw Error('Cannot sample retired XR color');
        const d=this.d,w=layer.textureWidth,h=layer.textureHeight,pitch=Math.ceil(w*4/256)*256,size=pitch*h*2;
        const b=d.createBuffer({size,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});
        try {
          const enc=d.createCommandEncoder();enc.copyTextureToBuffer({texture:layer.tex},{buffer:b,bytesPerRow:pitch,rowsPerImage:h},[w,h,2]);
          s.readback=true;d.queue.submit([enc.finish()]);
        } finally { s.readback=false; }
        return b.mapAsync(GPUMapMode.READ).then(()=>{
          const data=new Uint8Array(b.getMappedRange());return ['left','right'].map(eye=>{
            const out=new Uint8ClampedArray(w*h*4),off=s.stats.slices[eye]*pitch*h;
            for(let y=0;y<h;y++)out.set(data.subarray(off+y*pitch,off+y*pitch+w*4),y*w*4);
            return new ImageData(out,w,h);
          });
        }).finally(()=>b.destroy());
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
