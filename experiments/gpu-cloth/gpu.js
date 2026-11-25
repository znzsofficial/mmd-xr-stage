import solveCode from './cloth.wgsl?raw';
import renderCode from './surface.wgsl?raw';
import collisionCode from './contact.wgsl?raw';
import faceCode from './faceContact.wgsl?raw';
import {makeFaceSamples} from './faceSamples.js';
import {makeHandPass} from './handPass.js';
import {BOX_FLOATS,writeBounds} from './contactBounds.js';
import {contactPacket} from './rig.js';
import {makeSign} from './sign.js';

export async function openDevice(){
  if(!navigator.gpu)throw Error('此浏览器没有 WebGPU；请在支持 WebGPU 的浏览器用 HTTPS 打开');
  const xr=!!globalThis.XRGPUBinding && !!navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(()=>false);
  const xrAdapter=xr?await navigator.gpu.requestAdapter({xrCompatible:true}).catch(()=>null):null;
  const adapter=xrAdapter??await navigator.gpu.requestAdapter(),immerse=!!xrAdapter;
  if(!adapter)throw Error('未取得 WebGPU 设备');
  return {device:await adapter.requestDevice({requiredFeatures:adapter.features.has('timestamp-query')?['timestamp-query']:[]}),immerse};
}

export async function makeGpu(d,model,rig){
  let disposed=false;const owned=[],own=x=>(owned.push(x),x),dispose=()=>{disposed=true;for(const b of owned.splice(0))b.destroy();};
  const buf=(name,data,usage)=>{const size=Math.max(4,Math.ceil(data.byteLength/4)*4),b=own(d.createBuffer({label:name,size,usage:usage|GPUBufferUsage.COPY_DST}));
    // A Uint16 index buffer can end after an odd number of triangles. Pad
    // the upload only; material draw counts are still the authored counts.
    if(data.byteLength%4){const padded=new Uint8Array(size);padded.set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));d.queue.writeBuffer(b,0,padded);}
    else if(data.byteLength)d.queue.writeBuffer(b,0,data);return b;};
  const S=GPUBufferUsage.STORAGE,U=GPUBufferUsage.UNIFORM,V=GPUBufferUsage.VERTEX,mesh=model.mesh,geo=mesh.geometry;
  const bind=(layout,pairs)=>d.createBindGroup({layout,entries:pairs.map(([binding,buffer])=>({binding,resource:{buffer}}))});
  const shader=async(code,label)=>{const m=d.createShaderModule({code,label});const errors=(await m.getCompilationInfo()).messages.filter(m=>m.type==='error');if(errors.length)throw Error(label+': '+errors.map(m=>`${m.lineNum}: ${m.message}`).join('; '));return m;};
  try{
    const solver=await shader(collisionCode+solveCode,'裙摆求解'),surface=await shader(renderCode,'模型绘制');
    const cp=async entryPoint=>d.createComputePipelineAsync({layout:'auto',compute:{module:solver,entryPoint}});
    const predict=await cp('predict'),relax=await cp('constrain');
    const n=rig.nodes.length,targets=rig.rest.slice(),tbuf=buf('pose targets',targets,S),point=[0,1].map(i=>buf('solver '+i,targets,S|GPUBufferUsage.COPY_SRC));
    const history=buf('previous',new Float32Array(n*8),S),meta=buf('connections',rig.headers,S),edges=buf('edges',rig.links,S),caps=new Float32Array((rig.capsules.length+2)*8),cap=buf('capsules',caps,S);
    const params=[0,1].map(seed=>{const a=new ArrayBuffer(16);new Float32Array(a)[0]=1/72;new Uint32Array(a).set([seed,caps.length/8,n],1);return buf('step',new Uint32Array(a),U);});
    const pre=params.map(f=>bind(predict.getBindGroupLayout(0),[[0,f],[1,tbuf],[2,point[0]],[3,point[1]],[4,history]]));
    const boxes=new Float32Array(BOX_FLOATS),box=buf('contact bounds',boxes,U);
    const relaxGroups=(pipe,extra=[])=>[0,1].map(i=>bind(pipe.getBindGroupLayout(0),[[0,params[0]],[1,tbuf],[2,point[i]],[3,point[1-i]],[5,meta],[6,edges],[7,cap],[8,box],...extra]));
    const rgroup=relaxGroups(relax);let debug,debugPipes,unculled;
    const attributes=['position','uv','skinIndex','skinWeight'].map((name,i)=>{const a=geo.attributes[name];return buf(name,i===2?new Uint16Array(a.array):new Float32Array(a.array),V);});
    const idx=buf('faces',geo.index.array,GPUBufferUsage.INDEX),indexFormat=geo.index.array instanceof Uint32Array?'uint32':'uint16';
    const vertices=['float32x3','float32x2','uint16x4','float32x4'].map((format,i)=>({arrayStride:[12,8,8,16][i],attributes:[{shaderLocation:i,offset:0,format}]}));
    const lut=buf('bone to particle',rig.lookup,S),skeleton=mesh.skeleton;skeleton.update();const pal=buf('skin palette',skeleton.boneMatrices,S);
    const support=await makeHandPass({device:d,mesh,rig,buf,shader,bind,palette:pal,points:point[0],goals:tbuf,history,caps:cap,bounds:box,headers:meta});
    let handSurfaceEnabled=true;
    let facePass,faceShown=false,faceCount=0,display,residual;const zero=buf('no surface offset',new Float32Array(4),S);
    function surfaceEyes(cloth,points,offsets){return views.map(b=>bind(cloth.getBindGroupLayout(0),[[0,b],[1,pal],[2,lut],[3,points],[4,tbuf],[6,offsets]]));}
    async function prepareFaces(field){const fitted=makeFaceSamples(mesh,rig);faceCount=fitted.faces.length;if(!faceCount)return false;
      const m=await shader(collisionCode+faceCode,'裙面接触'),create=entryPoint=>d.createComputePipelineAsync({layout:'auto',compute:{module:m,entryPoint}});
      const [sample,gather,finish]=await Promise.all([create('sampleFace'),create('gather'),create('finishCorners')]);if(disposed)return false;const deltas=buf('surface responses',new Float32Array(faceCount*4),S),wall=buf('held skin wall',field.data,S);
      display=buf('display cloth',targets,S|GPUBufferUsage.COPY_SRC);residual=buf('garment corner offsets',new Float32Array(geo.attributes.position.count*4),S|GPUBufferUsage.COPY_SRC);
      const args=new ArrayBuffer(48);new Uint32Array(args).set([faceCount,caps.length/8]);new Float32Array(args).set([rig.scale,.95,...field.base,field.cell],2);new Uint32Array(args).set(field.dims,8);
      const inputs=buf('surface inputs',new Uint32Array(args),U),common=[[4,display],[5,deltas],[6,inputs]];
      facePass={sample,gather,finish,count:fitted.corners.length/16,fb:bind(finish.getBindGroupLayout(0),[[2,pal],[3,tbuf],[4,display],[6,inputs],[11,wall],[12,buf('cloth corner weights',fitted.corners,S)],[13,lut],[14,residual]]),sb:bind(sample.getBindGroupLayout(0),[...common,[0,buf('real faces',fitted.heads,S)],[1,buf('barycentric skin',fitted.terms,S)],[2,pal],[3,tbuf],[11,wall]]),
        gb:bind(gather.getBindGroupLayout(0),[...common,[7,cap],[8,box],[9,buf('node spans',fitted.ranges,S)],[10,buf('surface weights',fitted.refs,S)],[15,meta]])};
      for(const p of pipelines.values())p.eyes[1]=surfaceEyes(p.cloth,display,residual);return true;}
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
    const pipelines=new Map(),xrPreparation=new Map();
    async function prepare(format){if(disposed||pipelines.has(format))return;
      const render=(vs,fs,buffers)=>d.createRenderPipelineAsync({layout:'auto',vertex:{module:surface,entryPoint:vs,buffers},
        fragment:{module:surface,entryPoint:fs,targets:[{format,blend:{color:{srcFactor:'src-alpha',dstFactor:'one-minus-src-alpha'},alpha:{srcFactor:'one',dstFactor:'one-minus-src-alpha'}}}]},
        primitive:{topology:'triangle-list'},depthStencil:{format:'depth24plus',depthWriteEnabled:true,depthCompare:'less'}});
      const [cloth,hand]=await Promise.all([render('surface','shade',vertices),render('marker','gold',[])]);if(disposed)return;
      pipelines.set(format,{cloth,hand,eyes:[surfaceEyes(cloth,point[0],zero),facePass&&surfaceEyes(cloth,display,residual)],
        hands:views.map(b=>bind(hand.getBindGroupLayout(0),[[0,b],[5,cap]])),materials:mats.map(m=>d.createBindGroup({layout:cloth.getBindGroupLayout(1),entries:[{binding:0,resource:m.texture},{binding:1,resource:samp},{binding:2,resource:{buffer:m.tint}}]}))});}
    function update(hands,active){if(active&&handSurfaceEnabled)support.observe(hands);else support.reset();skeleton.update();d.queue.writeBuffer(pal,0,skeleton.boneMatrices);contactPacket(rig,hands,caps);d.queue.writeBuffer(cap,0,caps);
      if(active){writeBounds(caps,boxes);d.queue.writeBuffer(box,0,boxes);}
      if(active){for(const [i,node] of rig.nodes.entries()){const m=skeleton.bones[node.bone].matrixWorld.elements;for(let j=0;j<3;j++)targets[i*4+j]=m[12+j]*rig.scale;}d.queue.writeBuffer(tbuf,0,targets);}}
    function solve(encoder,steps,seed,timestampWrites,faces){if(!faces)faceShown=false;if(!steps)return;if(debug?.counted)encoder.clearBuffer(debugPipes.counter);const timedFaces=faces&&facePass&&timestampWrites;
      const handStep=support.begin(steps,seed);
      const pass=encoder.beginComputePass({timestampWrites:timedFaces?{querySet:timestampWrites.querySet,beginningOfPassWriteIndex:0}:timestampWrites});for(let i=0;i<steps;i++){
      pass.setPipeline(predict);pass.setBindGroup(0,pre[Number(seed&&i===0)]);pass.dispatchWorkgroups(Math.ceil(n/64));pass.setPipeline(debug?.pipe??relax);
      for(let k=0;k<5;k++){pass.setBindGroup(0,(debug?.groups??rgroup)[1-k%2]);pass.dispatchWorkgroups(Math.ceil(n/64));}
      if(handStep)support.run(pass,i);}
      pass.end();faceShown=!!(faces&&facePass);if(faceShown){encoder.copyBufferToBuffer(point[0],0,display,0,targets.byteLength);const surfacePass=encoder.beginComputePass({timestampWrites:timedFaces?{querySet:timestampWrites.querySet,endOfPassWriteIndex:1}:undefined});
        for(let k=0;k<2;k++){surfacePass.setPipeline(facePass.sample);surfacePass.setBindGroup(0,facePass.sb);surfacePass.dispatchWorkgroups(Math.ceil(faceCount/64));surfacePass.setPipeline(facePass.gather);surfacePass.setBindGroup(0,facePass.gb);surfacePass.dispatchWorkgroups(Math.ceil(n/64));}surfacePass.setPipeline(facePass.finish);surfacePass.setBindGroup(0,facePass.fb);surfacePass.dispatchWorkgroups(Math.ceil(facePass.count/64));surfacePass.end();}}
    // Actor-owned resources are keyed by device (this actor) and format, not by
    // session. Re-entry can share an unfinished compile, never replace its sign.
    function prepareXR(format){
      if(disposed)return Promise.resolve();
      if(!xrPreparation.has(format)){
        const ready=(async()=>{await prepare(format);if(disposed)return;
          // The mode label is optional; the landmark and actor do not depend on it.
          void makeSign(d,format,()=>!disposed).then(sign=>{if(disposed)sign?.dispose();else pipelines.get(format).sign=sign;},error=>{if(!disposed)console.warn('XR mode sign:',error);});
        })();
        xrPreparation.set(format,ready);ready.catch(()=>xrPreparation.delete(format));
      }
      return xrPreparation.get(format);
    }
    function draw(encoder,format,eye,matrix,color,depth,viewport,active,label,xrTarget){
      const p=pipelines.get(format);viewBlock.set(matrix);viewBlock.set([+active,rig.scale,rig.capsules.length,+(active&&faceShown)],16);d.queue.writeBuffer(views[eye],0,viewBlock);
      const pass=xrTarget?xrTarget.beginPass(encoder,matrix):encoder.beginRenderPass({colorAttachments:[{view:color,loadOp:'clear',storeOp:'store',clearValue:{r:.085,g:.063,b:.082,a:1}}],depthStencilAttachment:{view:depth,depthClearValue:1,depthLoadOp:'clear',depthStoreOp:'store'}});
      if(viewport&&!xrTarget)pass.setViewport(viewport.x,viewport.y,viewport.width,viewport.height,0,1);
      pass.setPipeline(p.cloth);pass.setBindGroup(0,p.eyes[Number(faceShown)][eye]);attributes.forEach((b,i)=>pass.setVertexBuffer(i,b));pass.setIndexBuffer(idx,indexFormat);
      for(const g of geo.groups)if(mats[g.materialIndex]?.visible){pass.setBindGroup(1,p.materials[g.materialIndex]);pass.drawIndexed(g.count,1,g.start);}
      pass.setPipeline(p.hand);pass.setBindGroup(0,p.hands[eye]);pass.draw(12*6*6,2);if(label)p.sign?.draw(pass,views[eye],label);pass.end();}
    // Explicit test sample, not used by animation or drawing.
    async function read(buffer,Type){const size=buffer.size,b=d.createBuffer({size,usage:GPUBufferUsage.MAP_READ|GPUBufferUsage.COPY_DST});try{const e=d.createCommandEncoder();e.copyBufferToBuffer(buffer,0,b,0,size);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);return new Type(b.getMappedRange().slice(0));}finally{b.destroy();}}
    async function countTests(cull){if(cull==null){debug=null;return;}if(!debugPipes){const counter=buf('test-only fine tests',new Uint32Array(n),S|GPUBufferUsage.COPY_SRC);
      const m=await shader(collisionCode+'\n@group(0) @binding(9) var<storage,read_write> counts:array<u32>;\n'+solveCode.replace('// COUNT_FINE_TESTS','counts[i]+=u32(hit.w);'),'碰撞验证');debugPipes={counter};
      for(const val of [true,false]){const pipe=await d.createComputePipelineAsync({layout:'auto',compute:{module:m,entryPoint:'constrain',constants:{cull:val}}});debugPipes[val]={pipe,groups:relaxGroups(pipe,[[9,counter]]),counted:true};}}
      debug=debugPipes[cull];}
    async function fullScan(on){if(on&&!unculled){const pipe=await d.createComputePipelineAsync({layout:'auto',compute:{module:solver,entryPoint:'constrain',constants:{cull:false}}});unculled={pipe,groups:relaxGroups(pipe)};}debug=on?unculled:null;}
    return {prepare,prepareXR,prepareFaces,update,solve,draw,resetHands:support.reset,handSamples:support.count,sample:()=>read(faceShown?display:point[0],Float32Array),targets,get faceCount(){return faceCount;},...(new URLSearchParams(location.search).has('probe')&&{handSurface(on){handSurfaceEnabled=on;support.reset();},fullScan,countTests,raw:()=>read(point[0],Float32Array),offsets:()=>faceShown?read(residual,Float32Array):null,checks:()=>read(debugPipes.counter,Uint32Array)}),dispose(){dispose();for(const p of pipelines.values())p.sign?.dispose();pipelines.clear();xrPreparation.clear();}};
  }catch(e){dispose();throw e;}
}
