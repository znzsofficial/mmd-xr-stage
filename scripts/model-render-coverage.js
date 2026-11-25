import * as T from 'three';
import {createMmdRuntimeHandle} from '../src/mmdVrShowcase/mmdRuntime/mmdRuntime';
import {prepareMmdVrModel} from '../src/mmdVrShowcase/stage/loading/prepareMmdVrModel';
import {prepareModelGpu} from '../src/mmdVrShowcase/stage/loading/prepareModelGpu';

const v=()=>new T.Vector3(),count=(pixels)=>{
  let n=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3])n++;return n;
};
function diff(a,b){let changed=0,over8=0,outline=0,max=0;for(let i=0;i<a.length;i+=4){const delta=Math.max(...[0,1,2,3].map(j=>Math.abs(a[i+j]-b[i+j])));if(delta)changed++;if(delta>8)over8++;if(!!a[i+3]!==!!b[i+3])outline++;max=Math.max(max,delta);}return {changed,over8,outline,max};}
function materials(mesh){return [].concat(mesh.material).filter(Boolean);}

// Intercept allocations, not the file sizes. This counts the immutable stores
// requested by this renderer, not driver/decoder memory or the headset budget.
function textureStores(gl){
  const bound=new Map(),stores=new Map(),sizeFor=new Map([[gl.RGBA8,4],[gl.SRGB8_ALPHA8,4],[gl.RGBA32F,16],[gl.RGBA16F,8],[gl.R8,1]]);let unit=gl.getParameter(gl.ACTIVE_TEXTURE);
  const wrap=(key,watch)=>{const fn=gl[key];gl[key]=function(...a){watch(...a);return fn.apply(this,a);};};
  wrap('activeTexture',u=>unit=u);wrap('bindTexture',(t,x)=>bound.set(unit+':'+t,x));wrap('deleteTexture',t=>stores.delete(t));
  const add=(t,levels,fmt,w,h,layers=1)=>{const tex=bound.get(unit+':'+t);if(!tex)return;let pixels=0;for(let i=0;i<levels;i++){pixels+=w*h*layers;w=Math.max(1,w>>1);h=Math.max(1,h>>1);}stores.set(tex,{target:t,bytes:pixels*(sizeFor.get(fmt)??0),format:fmt});};
  wrap('texStorage2D',add);wrap('texStorage3D',add);return ()=>{let arrays=0,bytes=0,arrayBytes=0,unpriced=0;for(const v of stores.values()){bytes+=v.bytes;if(!sizeFor.has(v.format))unpriced++;if(v.target===gl.TEXTURE_2D_ARRAY){arrays++;arrayBytes+=v.bytes;}}return {stores:stores.size,bytes,arrays,arrayBytes,unpriced};};
}
function rankBone(mesh,kind){
  const {bones}=mesh.skeleton,{skinWeight:w,skinIndex:s}=mesh.geometry.attributes,enabled=mesh.geometry.getAttribute(kind);
  const scores=new Float64Array(bones.length);if(!enabled)return -1;
  for(let i=0;i<enabled.count;i++)if(enabled.getX(i)>.5)for(let k=0;k<4;k++){const wt=w.getComponent(i,k);if(wt>0&&wt<1)scores[s.getComponent(i,k)]+=wt*(1-wt);}
  const joint=/ひじ|肘|手首|腕捩|手捩|膝|ひざ|elbow|forearm|wrist|knee/i;const factor=i=>joint.test([bones[i].name,bones[i].userData.mmdBoneName].join(' '))?8:1;
  const ranked=Array.from(scores.keys()).filter(i=>scores[i]>0).sort((i,j)=>scores[j]*factor(j)-scores[i]*factor(i));return ranked[0]??-1;
}

window.testActor=async({fileName,special='sdef',boneIndex,axis=[.38,.64,.66],degrees=75,duplicate=false,motion=null}={})=>{
  const files=[...document.querySelector('#folder').files],pmx=files.find(f=>fileName?f.name===fileName:/\.(pmx|pmd)$/i.test(f.name));if(!pmx)throw Error('Choose a local PMX or PMD');
  const canvas=document.querySelector('canvas'),renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:false,preserveDrawingBuffer:true});renderer.setSize(600,600,false);renderer.setClearColor(0,0);
  const gl=renderer.getContext(),storeCounts=duplicate?textureStores(gl):null,scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.01,2000),light=new T.DirectionalLight(0xfff4e8,1.1);light.position.set(-3,4,5);scene.add(light,new T.AmbientLight(0xffffff,.55));
  renderer.shadowMap.enabled=!duplicate;light.castShadow=!duplicate;light.shadow.mapSize.set(256,256);
  const rt=createMmdRuntimeHandle(scene,{prepareModel:prepareMmdVrModel,prepareGpu:(o,stale,work)=>prepareModelGpu(renderer,scene,camera,o,stale,work)});
  const kind=special==='qdef'?'matricesQdefEnabled':'matricesSdefEnabled';let zoom=1,centre=v(),eye=v(),sizes={};
  function frame(){camera.position.copy(eye).multiplyScalar(zoom);camera.near=.005*zoom;camera.far=1500*zoom;camera.lookAt(centre.clone().multiplyScalar(zoom));camera.updateProjectionMatrix();camera.updateMatrixWorld();renderer.render(scene,camera);
    const a=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;}
  function memory(){return {...renderer.info.memory,...storeCounts?.()};}
  function maps(mesh){return [...new Set(materials(mesh).map(m=>m.map).filter(t=>t?.image))];}
  function handles(mesh){return new Set(maps(mesh).map(t=>renderer.properties.get(t).__webglTexture).filter(Boolean));}
  const update=(s=0)=>rt.update(s,false,camera,1,false,0);
  const load=()=>rt.addModel(pmx,files,{transform:{scale:1,positionX:0},physics:false});
  try{
    const empty=memory(),report=await load(),id=report.modelId,{root,mesh}=rt.getModelSurface(id),sk=mesh.skeleton,bones=sk.bones;
    rt.setLighting({envIntensity:0,ambientIntensity:.55,directionalLight:light});update();root.updateMatrixWorld(true);
    // Derive framing from the bind geometry, not from labels or hair helpers.
    const bounds=new T.Box3().setFromBufferAttribute(mesh.geometry.attributes.position),height=bounds.max.y-bounds.min.y;
    centre=bounds.getCenter(v());eye=centre.clone().addScaledVector(new T.Vector3(.18,.06,1.7),height);const rest=frame();
    const common={vertices:mesh.geometry.attributes.position.count,bones:bones.length,materials:materials(mesh).length,drawCalls:renderer.info.render.calls,missing:report.missingTextures.length,visiblePixels:count(rest)};
    if(common.visiblePixels<60)throw Error('Actor is not visible');
    if(duplicate){const first=memory(),h1=handles(mesh),other=await load(),m2=rt.getModelSurface(other.modelId).mesh;update();frame();const second=memory(),h2=handles(m2);rt.removeModel(id);const kept=frame(),one=memory();rt.removeModel(other.modelId);frame();const end=memory(),survivor=diff(kept,rest);if(end.textures!==empty.textures||one.textures!==first.textures||survivor.over8>5)throw Error('Resource or appearance mismatch '+JSON.stringify({first,one,end,survivor}));return {...common,counts:{empty,first,second,one,end},diffuse:{slots:materials(mesh).filter(m=>m.map).length,unique:h1.size,shared:[...h1].filter(h=>h2.has(h)).length},survivor};}
    if(motion){const f=new File([Uint8Array.from(motion.bytes)],'case.vmd');await rt.loadMotion(f,motion.slot??'face',id);const max=rt.duration;
      const slot=motion.materialIndex,gr=mesh.geometry.groups.find(g=>g.materialIndex===slot),source=[].concat(mesh.material),material=source[slot];
      update(0);if(gr){const ids=mesh.geometry.index,box=new T.Box3(),p=v();for(let k=gr.start;k<gr.start+gr.count;k++)box.expandByPoint(mesh.localToWorld(mesh.getVertexPosition(ids.getX(k),p)));
        centre=box.getCenter(v());eye=centre.clone().addScaledVector(new T.Vector3(.22,.10,motion.rear?-1:1),Math.max(height*.14,box.getSize(v()).length()*1.18));}
      // Isolated authored draw for material/UV probes so other clothing can
      // neither hide the result nor generate a false positive. This is not a
      // screenshot of the default outfit; the full actor was drawn above.
      const owners=root.getObjectsByProperty('isSkinnedMesh',true);const isolate=()=>{if(!gr)return;for(const o of owners){const s=o.userData.mmdMorphSplitBody?.materialIndex??o.userData.mmdMaterialRenderProxy?.materialIndex;if(o!==mesh)o.visible=s===slot&&!o.userData.mmdOutlineProxy;}for(let j=0;j<source.length;j++)if(j!==slot&&source[j])source[j].visible=false;};
      const shots=motion.times.map((t,i)=>{if(motion.manualName)rt.setMorphWeight(id,motion.manualName,[0,.5,1,0][i]);update(t);isolate();return frame();});const result={...common,duration:max,fromStart:shots.map(x=>diff(shots[0],x)),visible:shots.map(count)};
      if(motion.positive==='alpha'){
        // An authored zero-alpha slot can also have a zero-alpha PMX shader
        // factor. Prove the selected real triangles are in frame using a
        // separate opaque geometry-only draw, not another morph assertion.
        const geometry=new T.BufferGeometry(),solid=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide});
        const coords=new Float32Array(gr.count*3),p=v();for(let i=0;i<gr.count;i++)mesh.localToWorld(mesh.getVertexPosition(mesh.geometry.index.getX(gr.start+i),p)).toArray(coords,i*3);
        geometry.setAttribute('position',new T.Float32BufferAttribute(coords,3));const check=new T.Mesh(geometry,solid);check.frustumCulled=false;scene.add(check);try{result.opaqueGeometryControl=diff(shots[0],frame());}finally{scene.remove(check);geometry.dispose();solid.dispose();}}
      if(motion.positive==='uv'){const saved=new Map();for(const o of owners){const uv=o.geometry.attributes.uv,local=o.userData.mmdMorphSplitBody?.morphTargetIndices?.indexOf(motion.index)??motion.index,target=o.geometry.morphAttributes.uv?.[local];if(!target||saved.has(uv))continue;saved.set(uv,uv.array.slice());for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)+.5*target.getX(i),uv.getY(i)+.5*target.getY(i));uv.needsUpdate=true;}
        result.positive=diff(shots[0],frame());for(const [attr,raw] of saved){attr.array.set(raw);attr.needsUpdate=true;}}
      return result;}
    const bi=boneIndex??rankBone(mesh,kind);if(bi<0||!bones[bi])throw Error('No weighted joint with the requested skin type');
    const bone=bones[bi],bind=bone.quaternion.clone(),bend=bind.clone().multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(...axis).normalize(),degrees*Math.PI/180));
    centre=bone.getWorldPosition(v());eye=centre.clone().addScaledVector(new T.Vector3(.12,.07,.48),height);
    const flags=new Set();root.traverse(o=>{const a=o.geometry?.attributes[kind];if(a)flags.add(a);});const saved=[...flags].map(a=>[a,a.array.slice()]);
    function draw(scale,q,linear=false){zoom=scale;root.scale.setScalar(scale);bone.quaternion.copy(q);root.updateMatrixWorld(true);sk.update();for(const [attr,source] of saved){if(linear)attr.array.fill(0);else attr.array.set(source);attr.needsUpdate=true;}return frame();}
    const before=draw(1,bind),posed=draw(1,bend),linear=draw(1,bend,true),small=draw(.1,bend),smallLinear=draw(.1,bend,true),again=draw(1,bind);
    sizes={type:special,boneIndex:bi,count:mesh.geometry.attributes[kind].array.reduce((s,b)=>s+(b>.5),0),pose:diff(before,posed),typeVsLinear:diff(posed,linear),scaled:diff(posed,small),linearScaled:diff(linear,smallLinear),restored:diff(before,again),fragments:count(posed)};
    for(const p of renderer.info.programs??[]){if(!gl.getProgramParameter(p.program,gl.LINK_STATUS)||![p.vertexShader,p.fragmentShader].every(s=>gl.getShaderParameter(s,gl.COMPILE_STATUS)))throw Error('Shader compile/link failed');}
    if(!sizes.count||!sizes.pose.over8||sizes.restored.over8||sizes.scaled.outline>sizes.linearScaled.outline+8||sizes.scaled.over8>sizes.linearScaled.over8+80)throw Error('No repeatable scale-equivalent articulation: '+JSON.stringify(sizes));return {...common,...sizes,programs:renderer.info.programs.length};
  }finally{rt.dispose();light.shadow.dispose();renderer.dispose();renderer.forceContextLoss();}
};
document.querySelector('button').onclick=async e=>{const b=e.currentTarget;b.disabled=true;try{document.querySelector('pre').textContent=JSON.stringify(await testActor(),null,2);}catch(err){document.querySelector('pre').textContent=String(err);}finally{b.disabled=false;}};
