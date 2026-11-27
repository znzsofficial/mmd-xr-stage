// Only the display is simulated. The lab still uses real WebGPU render passes,
// depth attachments, readback, shaders and its normal requestSession button.
module.exports = function stereoShim(eyeSize=240){
  let active;
  const cfg=window.labFixture={reject:false,colorOnly:false,tracking:true,headX:0};
  const id=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  Object.defineProperty(navigator,'xr',{configurable:true,value:{async isSessionSupported(){return true;},async requestSession(mode,options){
    if(mode!=='immersive-vr'||!options.requiredFeatures.includes('webgpu')||!options.optionalFeatures?.includes('hand-tracking'))throw Error('wrong session');
    if(cfg.reject)throw new DOMException('user rejected','NotAllowedError');
    const s=active=Object.assign(new EventTarget(),{inputSources:['left','right'].map(handedness=>({handedness,gripSpace:{handedness},gamepad:{buttons:Array.from({length:6},()=>({pressed:false}))}})),
      visibilityState:'visible',supportedFrameRates:[72],frameRate:72,updateRenderState(){},async requestReferenceSpace(){return{};},
      // No callback for this hint. Receiving frames must be independent.
      updateTargetFrameRate(){return new Promise(()=>{});},requestAnimationFrame(fn){return s.raf=requestAnimationFrame(t=>{if(s!==active)return;
        const views=[0,1].map(i=>{const m=id.slice();m[12]=(i?-.032:.032)-cfg.headX;m[13]=-1.45;
          return {eye:i?'right':'left',i,projectionMatrix:[1.1,0,0,0,0,1.1,0,0,0,0,-1,-1,0,0,-.01,0],transform:{inverse:{matrix:m}}};});
        fn(t,{session:s,getViewerPose:()=>cfg.tracking?{views}:null,getPose:space=>({transform:{position:{x:space.handedness==='right'?.15:-.25,y:1.1,z:-.60}}}),getJointPose:j=>cfg.loseLeft&&j.side==='left'?null:{transform:{position:{x:(j.side==='left'?-.23:.28)+(j.name==='pinky-finger-phalanx-proximal'?.03:j.name==='index-finger-phalanx-proximal'?-.03:0),y:j.name==='wrist'?.99:1.07,z:-.65}},radius:.011}});});},
      async end(){if(s!==active)return;cancelAnimationFrame(s.raf);active=null;s.dispatchEvent(new Event('end'));s.release?.();}});
    window.labSession=s;return s;
  }}});
  window.XRGPUBinding=class{
    constructor(s,d){this.d=d;this.s=s;}getPreferredColorFormat(){return 'rgba8unorm';}
    createProjectionLayer({colorFormat,depthStencilFormat,scaleFactor=1}){
      if(depthStencilFormat&&cfg.colorOnly)throw new DOMException('Only color is available','NotSupportedError');
      const extent=Math.max(1,Math.floor(eyeSize*Math.min(cfg.scaleLimit??Infinity,scaleFactor))),rgbaPitch=Math.ceil(extent*4/256)*256;
      const d=this.d,size=[extent,extent,2],tex=d.createTexture({size,format:colorFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT|GPUTextureUsage.COPY_SRC}),
        depth=depthStencilFormat?d.createTexture({size,format:depthStencilFormat,usage:GPUTextureUsage.RENDER_ATTACHMENT}):null;
      this.s.release=()=>{tex.destroy();depth?.destroy();};
      this.s.capture=async(reference)=>{const stride=rgbaPitch*extent,b=d.createBuffer({size:stride*2,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});
        try{const e=d.createCommandEncoder();e.copyTextureToBuffer({texture:tex},{buffer:b,bytesPerRow:rgbaPitch,rowsPerImage:extent},size);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);
          const a=new Uint8Array(b.getMappedRange());let different=0,light=[0,0],changed=[0,0];const sums=[[0,0],[0,0]],counts=[[0,0],[0,0]];
          for(let y=0;y<extent;y++)for(let x=0;x<extent;x++){const k=y*rgbaPitch+x*4;for(let j=0;j<2;j++){
            const n=k+j*stride;if(a[n]>75)light[j]++;if(this.reference&&[0,1,2].some(c=>Math.abs(a[n+c]-this.reference[n+c])>15))changed[j]++;
            const post=a[n]>235&&a[n+1]>116&&a[n+1]<130&&a[n+2]<46?0:a[n]<35&&a[n+1]>186&&a[n+1]<202&&a[n+2]>174&&a[n+2]<192?1:-1;
            if(post>=0){sums[j][post]+=x;counts[j][post]++;}}
            if([0,1,2].some(c=>a[k+c]!==a[k+stride+c]))different++;}
          if(reference)this.reference=a.slice();return {different,light,changed,postX:sums.map((row,j)=>row.map((x,i)=>counts[j][i]>8?x/counts[j][i]:null))};
        }finally{b.destroy();}};
      return {tex,depth,textureWidth:extent,textureHeight:extent,textureArrayLength:2};
    }
    getViewSubImage(l,v){if(v.i===1&&cfg.failRight)throw new DOMException('right image unavailable','InvalidStateError');return {colorTexture:l.tex,depthStencilTexture:l.depth,getViewDescriptor:()=>({dimension:'2d',baseArrayLayer:1-v.i,arrayLayerCount:1}),viewport:{x:4,y:5,width:l.textureWidth-8,height:l.textureHeight-10}};}
  };
};
