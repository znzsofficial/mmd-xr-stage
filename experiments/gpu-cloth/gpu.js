import solveCode from './cloth.wgsl?raw';
import renderCode from './surface.wgsl?raw';
import {contactPacket} from './rig.js';
import {makeSign} from './sign.js';

export async function openDevice(){
  if(!navigator.gpu)throw Error('此浏览器没有 WebGPU；请在支持 WebGPU 的浏览器用 HTTPS 打开');
  const xr=!!globalThis.XRGPUBinding && !!navigator.xr && await navigator.xr.isSessionSupported('immersive-vr');
  let adapter=await navigator.gpu.requestAdapter(xr?{xrCompatible:true}:{}),immerse=xr;
  if(!adapter&&xr){adapter=await navigator.gpu.requestAdapter();immerse=false;}
  if(!adapter)throw Error('未取得 WebGPU 设备');
  return {device:await adapter.requestDevice({requiredFeatures:adapter.features.has('timestamp-query')?['timestamp-query']:[]}),immerse};
}

export async function makeGpu(d,model,rig){
  const owned=[],own=x=>(owned.push(x),x),dispose=()=>{for(const b of owned.splice(0))b.destroy();};
  const buf=(name,data,usage)=>{const b=own(d.createBuffer({label:name,size:Math.max(4,(data.byteLength+3)&~3),usage:usage|GPUBufferUsage.COPY_DST}));if(data.byteLength)d.queue.writeBuffer(b,0,data);return b;};
  const S=GPUBufferUsage.STORAGE,U=GPUBufferUsage.UNIFORM,V=GPUBufferUsage.VERTEX,mesh=model.mesh,geo=mesh.geometry;
  const bind=(layout,pairs)=>d.createBindGroup({layout,entries:pairs.map(([binding,buffer])=>({binding,resource:{buffer}}))});
  const shader=async(code,label)=>{const m=d.createShaderModule({code,label});const errors=(await m.getCompilationInfo()).messages.filter(m=>m.type==='error');if(errors.length)throw Error(label+': '+errors.map(m=>`${m.lineNum}: ${m.message}`).join('; '));return m;};
  try{
    const solver=await shader(solveCode,'裙摆求解'),surface=await shader(renderCode,'模型绘制');
    const cp=async entryPoint=>d.createComputePipelineAsync({layout:'auto',compute:{module:solver,entryPoint}});
    const predict=await cp('predict'),relax=await cp('constrain');
    const n=rig.nodes.length,targets=rig.rest.slice(),tbuf=buf('pose targets',targets,S),point=[0,1].map(i=>buf('solver '+i,targets,S|GPUBufferUsage.COPY_SRC));
    const history=buf('previous',new Float32Array(n*8),S),meta=buf('connections',rig.headers,S),edges=buf('edges',rig.links,S),caps=new Float32Array((rig.capsules.length+2)*8),cap=buf('capsules',caps,S);
    const params=[0,1].map(seed=>{const a=new ArrayBuffer(16);new Float32Array(a)[0]=1/72;new Uint32Array(a).set([seed,caps.length/8,n],1);return buf('step',new Uint32Array(a),U);});
    const pre=params.map(f=>bind(predict.getBindGroupLayout(0),[[0,f],[1,tbuf],[2,point[0]],[3,point[1]],[4,history]]));
    const rgroup=[0,1].map(i=>bind(relax.getBindGroupLayout(0),[[0,params[0]],[1,tbuf],[2,point[i]],[3,point[1-i]],[5,meta],[6,edges],[7,cap]]));
    const attributes=['position','uv','skinIndex','skinWeight'].map((name,i)=>{const a=geo.attributes[name];return buf(name,i===2?new Uint16Array(a.array):new Float32Array(a.array),V);});
    const idx=buf('faces',geo.index.array,GPUBufferUsage.INDEX),indexFormat=geo.index.array instanceof Uint32Array?'uint32':'uint16';
    const vertices=['float32x3','float32x2','uint16x4','float32x4'].map((format,i)=>({arrayStride:[12,8,8,16][i],attributes:[{shaderLocation:i,offset:0,format}]}));
    const lut=buf('bone to particle',rig.lookup,S),skeleton=mesh.skeleton;skeleton.update();const pal=buf('skin palette',skeleton.boneMatrices,S);
    const viewBlock=new Float32Array(20),views=[0,1].map(()=>buf('eye',viewBlock,U));
    const samp=d.createSampler({magFilter:'linear',minFilter:'linear',addressModeU:'repeat',addressModeV:'repeat'});
    const upload=new Map();const mats=[];
    for(const m of [].concat(mesh.material)){
      let image=m.map?.image;const key=image??null;if(!upload.has(key)){
        const w=image?.width??1,h=image?.height??1;if(Math.max(w,h)>d.limits.maxTextureDimension2D)throw Error('贴图尺寸超出 WebGPU 设备上限');
        const tex=own(d.createTexture({size:[w,h],format:'rgba8unorm',usage:GPUTextureUsage.TEXTURE_BINDING|GPUTextureUsage.COPY_DST|GPUTextureUsage.RENDER_ATTACHMENT}));
        if(image){d.queue.copyExternalImageToTexture({source:image,flipY:!!m.map.flipY},{texture:tex},[w,h]);}else d.queue.writeTexture({texture:tex},new Uint8Array([255,255,255,255]),{},[1,1]);upload.set(key,tex.createView());}
      mats.push({texture:upload.get(key),tint:buf('diffuse',new Float32Array([...(m.color?.toArray()??[1,1,1]),m.opacity??1]),U),visible:m.visible!==false&&m.opacity>.001});
    }
    const pipelines=new Map();
    async function prepare(format){if(pipelines.has(format))return;
      const render=(vs,fs,buffers)=>d.createRenderPipelineAsync({layout:'auto',vertex:{module:surface,entryPoint:vs,buffers},
        fragment:{module:surface,entryPoint:fs,targets:[{format,blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha'}}}]},
        primitive:{topology:'triangle-list'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
      const cloth=await render('surface','shade',vertices),hand=await render('marker','gold',[]);
      pipelines.set(format,{cloth,hand,eyes:views.map(b=>bind(cloth.getBindGroupLayout(0),[[0,b],[1,pal],[2,lut],[3,point[0]],[4,tbuf]])),
        hands:views.map(b=>bind(hand.getBindGroupLayout(0),[[0,b],[5,cap]])),materials:mats.map(m=>d.createBindGroup({layout:cloth.getBindGroupLayout(1),entries:[{binding:0,resource:m.texture},{binding:1,resource:samp},{binding:2,resource:{buffer:m.tint}}]}))});}
    function update(hands,active){skeleton.update();d.queue.writeBuffer(pal,0,skeleton.boneMatrices);contactPacket(rig,hands,caps);d.queue.writeBuffer(cap,0,caps);
      if(active){for(const [i,node] of rig.nodes.entries()){const m=skeleton.bones[node.bone].matrixWorld.elements;for(let j=0;j<3;j++)targets[i*4+j]=m[12+j]*rig.scale;}d.queue.writeBuffer(tbuf,0,targets);}}
    function solve(encoder,steps,seed,timestampWrites){if(!steps)return;const pass=encoder.beginComputePass({timestampWrites});for(let i=0;i<steps;i++){
      pass.setPipeline(predict);pass.setBindGroup(0,pre[Number(seed&&i===0)]);pass.dispatchWorkgroups(Math.ceil(n/64));pass.setPipeline(relax);
      for(let k=0;k<5;k++){pass.setBindGroup(0,rgroup[1-k%2]);pass.dispatchWorkgroups(Math.ceil(n/64));}}
      pass.end();}
    let sign;async function prepareXR(format){await prepare(format);sign?.dispose();sign=await makeSign(d,format);}
    function draw(encoder,format,eye,matrix,color,depth,viewport,active,label){
      const p=pipelines.get(format);viewBlock.set(matrix);viewBlock.set([+active,rig.scale,rig.capsules.length,0],16);d.queue.writeBuffer(views[eye],0,viewBlock);
      const pass=encoder.beginRenderPass({colorAttachments:[{view:color,loadOp:'clear',storeOp:'store',clearValue:{r:.085,g:.063,b:.082,a:1}}],depthStencilAttachment:{view:depth,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
      if(viewport)pass.setViewport(viewport.x,viewport.y,viewport.width,viewport.height,0,1);
      pass.setPipeline(p.cloth);pass.setBindGroup(0,p.eyes[eye]);attributes.forEach((b,i)=>pass.setVertexBuffer(i,b));pass.setIndexBuffer(idx,indexFormat);
      for(const g of geo.groups)if(mats[g.materialIndex]?.visible){pass.setBindGroup(1,p.materials[g.materialIndex]);pass.drawIndexed(g.count,1,g.start);}
      pass.setPipeline(p.hand);pass.setBindGroup(0,p.hands[eye]);pass.draw(12*6*6,2);if(label)sign?.draw(pass,views[eye],label);pass.end();}
    // Explicit test sample, not used by animation or drawing.
    async function sample(){const size=targets.byteLength,b=d.createBuffer({size,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});try{const e=d.createCommandEncoder();e.copyBufferToBuffer(point[0],0,b,0,size);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);return new Float32Array(b.getMappedRange().slice(0));}finally{b.destroy();}}
    return {prepare,prepareXR,update,solve,draw,sample,targets,dispose(){sign?.dispose();dispose();}};
  }catch(e){dispose();throw e;}
}
