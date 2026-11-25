import * as T from 'three';
import {createMmdRuntimeHandle} from '../src/mmdVrShowcase/mmdRuntime/mmdRuntime.ts';
import {prepareMmdVrModel} from '../src/mmdVrShowcase/stage/loading/prepareMmdVrModel.ts';
import {prepareModelGpu} from '../src/mmdVrShowcase/stage/loading/prepareModelGpu.ts';
import {materialDraws} from '../src/mmdVrShowcase/bodyState/lactation/outletFit.ts';

const vec=()=>new T.Vector3();
const check=(condition,message)=>{if(!condition)throw Error(message);};
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const note=text=>{document.querySelector('#status').textContent=text;};
const role=o=>o.userData.mmdOutlineProxy?'outline':o.userData.mmdMaterialRenderProxy?'material':o.userData.mmdMorphSplitBody?'split':'source';
const slot=o=>o.userData.mmdMaterialRenderProxy?.materialIndex??o.userData.mmdOutlineProxy?.sourceMaterialIndex??o.userData.mmdMorphSplitBody?.materialIndex;

function difference(a,b){
  check(a?.length&&a.length===b?.length,'Readback dimensions differ');
  let changed=0,over8=0,max=0,alphaMask=0;
  for(let i=0;i<a.length;i+=4){
    const d=Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]),Math.abs(a[i+3]-b[i+3]));
    if(d)changed++;if(d>8)over8++;if(d>max)max=d;if(!!a[i+3]!==!!b[i+3])alphaMask++;
  }
  return {changed,over8,max,alphaMask};
}
function coverage(p){let n=0;for(let i=3;i<p.length;i+=4)if(p[i]>8)n++;return n;}

// Observe the actual immutable stores, including the first shadow draw. The
// identity is that of the drawn BufferGeometry, not an estimate from the PMX.
// Store integers, not Three object references, across instance removals.
function watchArrays(gl){
  let unit=gl.getParameter(gl.ACTIVE_TEXTURE),seq=0,submitting=null;
  const bindings=new Map(),live=new Map();
  const wrap=(key,after)=>{const original=gl[key];gl[key]=function(...args){const result=original.apply(this,args);after(...args);return result;};};
  wrap('activeTexture',u=>{unit=u;});
  wrap('bindTexture',(target,texture)=>{if(target===gl.TEXTURE_2D_ARRAY)bindings.set(unit,texture);});
  wrap('deleteTexture',t=>{live.delete(t);for(const [u,b] of bindings)if(b===t)bindings.delete(u);});
  wrap('texStorage3D',(target,levels,format,w,h,layers)=>{
    if(target!==gl.TEXTURE_2D_ARRAY)return;
    const tex=bindings.get(unit);check(tex,'Unbound array allocation');
    // r187 WebGLMorphtargets allocates RGBA32F, mip level 0 only. Never price
    // a different format at 16 B/texel and silently call it a morph atlas.
    check(levels===1&&format===gl.RGBA32F,'Unexpected array format/mipmap count');
    live.set(tex,{allocation:++seq,...submitting,w,h,layers,bytes:w*h*layers*16});
  });
  return {
    trace(r){const direct=r.renderBufferDirect;r.renderBufferDirect=function(camera,scene,g,m,o,group){
      submitting={geometry:g.id,firstRole:role(o),firstPass:m.isMeshDepthMaterial?'depth':'color'};
      try{return direct.call(this,camera,scene,g,m,o,group);}finally{submitting=null;}
    };},
    snapshot(r){const atlases=[...live.values()];return {...r.info.memory,arrays:atlases.length,arrayBytes:atlases.reduce((n,t)=>n+t.bytes,0),atlases};},
  };
}

function createBench(){
  const canvas=document.querySelector('canvas'),gl=canvas.getContext('webgl2',{alpha:true,antialias:false,preserveDrawingBuffer:true});
  check(gl,'WebGL2 is required');
  const stores=watchArrays(gl),renderer=new T.WebGLRenderer({canvas,context:gl});stores.trace(renderer);
  renderer.setSize(512,512,false);renderer.setClearColor(0,0);renderer.shadowMap.enabled=true;
  renderer.debug.onShaderError=(ctx,program,vs,fs)=>{throw Error([ctx.getProgramInfoLog(program),ctx.getShaderInfoLog(vs),ctx.getShaderInfoLog(fs)].join('\n'));};
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.01,1000),light=new T.DirectionalLight(0xffffff,1.35);
  light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.position.set(-2,4,3);light.shadow.bias=-.00015;
  const floor=new T.Mesh(new T.PlaneGeometry(1,1),new T.ShadowMaterial({color:0,opacity:1}));
  floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
  scene.add(light,light.target,new T.AmbientLight(0xffffff,.65),floor);
  function view(eye,at){camera.position.copy(eye);camera.lookAt(at);camera.updateProjectionMatrix();camera.updateMatrixWorld();}
  function draw(read=true){
    renderer.render(scene,camera);
    check(!gl.isContextLost(),'WebGL context was lost');
    let p;if(read){p=new Uint8Array(canvas.width*canvas.height*4);gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,p);}
    const error=gl.getError();check(error===gl.NO_ERROR,`WebGL error 0x${error.toString(16)}`);return p;
  }
  // Warm the receiver and renderer-owned shadow target before taking an empty
  // reading. Keep both resident in *both* arms and throughout the pair test.
  view(new T.Vector3(0,2,2),vec());draw(false);
  function programs(){for(const p of renderer.info.programs){check(gl.getProgramParameter(p.program,gl.LINK_STATUS),`Program ${p.id} not linked`);
    for(const s of [p.vertexShader,p.fragmentShader])check(gl.getShaderParameter(s,gl.COMPILE_STATUS),`Program ${p.id} shader failed`);}
    return renderer.info.programs.length;
  }
  const info=gl.getExtension('WEBGL_debug_renderer_info');
  return {renderer,scene,camera,light,floor,view,draw,programs,memory:()=>stores.snapshot(renderer),
    device:{three:T.REVISION,renderer:info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),maxTextureSize:gl.getParameter(gl.MAX_TEXTURE_SIZE)},
    dispose(){floor.geometry.dispose();floor.material.dispose();light.shadow.dispose();renderer.dispose();renderer.forceContextLoss();}};
}

// A real single-track VMD, 0/30/60/90 frames. A manual override of zero
// merely removes an override and need not restore an unanimated actor.
export function expressionTrack(config,source){
  const name=config.morphName??'まばたき',hex=config.trackNameHex??'82dc82ce82bd82ab';
  check(/^(?:[\da-fA-F]{2}){1,15}$/.test(hex),'Invalid CP932 track name');
  const label=Uint8Array.from(hex.match(/../g),s=>parseInt(s,16));
  check(new TextDecoder('shift_jis',{fatal:true}).decode(label)===name,'VMD bytes do not match the morph name');
  const index=source.morphTargetDictionary[name];check(Number.isInteger(index)&&source.userData.mmdMorphs[index]?.type==='vertex','Choose a real vertex expression');
  if(config.morphIndex!==undefined)check(index===config.morphIndex,'Wrong PMX morph index');
  const bytes=new Uint8Array(166),d=new DataView(bytes.buffer);bytes.set(new TextEncoder().encode('Vocaloid Motion Data 0002'));
  d.setUint32(54,4,true);[0,.5,1,0].forEach((weight,i)=>{const o=58+23*i;bytes.set(label,o);d.setUint32(o+15,30*i,true);d.setFloat32(o+19,weight,true);});
  return {file:new File([bytes],'atlas-parity.vmd'),index};
}

// Frame the real moving region (including compact per-material indices).
// The camera is computed once at rest, never from the current expression.
function framing(b,surface,index){
  const {mesh}=surface,bounds=new T.Box3().setFromBufferAttribute(mesh.geometry.attributes.position),h=bounds.max.y-bounds.min.y;
  check(Number.isFinite(h)&&h>0,'Empty actor bounds');
  const bodies=mesh.userData.mmdMorphSplitBodyMeshes??[mesh],face=new T.Box3(),p=vec();let movingDraws=0;
  for(const body of bodies){const i=body.userData.mmdMorphSplitBody?.morphTargetIndices.indexOf(index)??index;
    const g=body.geometry,offset=g.morphAttributes.position?.[i];if(!offset)continue;
    let moving=0;for(let j=0;j<offset.count;j++)if(p.fromBufferAttribute(offset,j).lengthSq()>(.002*h)**2){face.expandByPoint(p.fromBufferAttribute(g.attributes.position,j));moving++;}
    if(moving)movingDraws++;
  }
  check(movingDraws>0&&!face.isEmpty(),'No measured vertex expression on draw geometry');
  const center=bounds.getCenter(vec()),faceAt=face.getCenter(vec()),floorAt=center.clone();floorAt.y=bounds.min.y-.002*h;
  const {light,floor,camera}=b;light.position.copy(center).add(new T.Vector3(-1.25,1.85,1.15).multiplyScalar(h));light.target.position.copy(center);
  Object.assign(light.shadow.camera,{left:-1.35*h,right:1.35*h,top:1.35*h,bottom:-1.35*h,near:.03*h,far:6*h});light.shadow.camera.updateProjectionMatrix();
  floor.position.copy(floorAt);floor.scale.setScalar(12*h);camera.near=.002*h;camera.far=15*h;
  const groundAt=floorAt.clone().add(new T.Vector3(.28*h,0,-.24*h));
  return {h,movingDraws,
    whole(){floor.visible=false;b.view(center.clone().add(new T.Vector3(.07,.025,1.85).multiplyScalar(h)),center);},
    close(){floor.visible=false;const dist=Math.max(.24*h,Math.min(.65*h,face.getSize(vec()).length()*2));b.view(faceAt.clone().add(new T.Vector3(0,0,dist)),faceAt);},
    ground(){floor.visible=true;b.view(groundAt.clone().add(new T.Vector3(0,2.8*h,.01*h)),groundAt);},
  };
}

// Use the authored source group as oracle, independent of the candidate's
// saved drawRange and its raycast implementation. A compact body has its own
// index buffer whose first triangle corresponds to the start of that group.
export function checkRanges(surface,scale){
  const {mesh,renderOrderMeshes}=surface,split=mesh.userData.mmdMorphSplitBodyMeshes??[];
  const draws=split.length?split.flatMap(body=>materialDraws({root:surface.root,mesh:body,renderOrderMeshes:[]})??[]):materialDraws(surface);
  check(draws?.length>1,'No independent material draw ranges');
  const rows=draws.map(({owner,material,start,end})=>{
    const i=slot(owner)??[].concat(mesh.material).indexOf(material),group=mesh.geometry.groups.find(g=>g.materialIndex===i);
    const compact=!!owner.userData.mmdMorphSplitBody,lo=compact?0:group?.start,hi=lo+group?.count;
    check(group&&start===lo&&end===hi,`Consumer range disagrees with PMX group ${i}: ${start}..${end} vs ${lo}..${hi}`);
    const geo=owner.geometry,idx=geo.index,tri=new T.Triangle(),mid=vec(),normal=vec();let face=-1,best=0;
    // Avoid zero-area faces. A deterministic spread gives a stable witness
    // even when the first triangles on a very thin material are degenerate.
    for(let k=start;k<end;k+=3*Math.max(1,Math.floor((end-start)/192))){
      for(const [j,q] of [tri.a,tri.b,tri.c].entries())owner.localToWorld(owner.getVertexPosition(idx.getX(k+j),q));
      const area=tri.getArea();if(area<=best)continue;best=area;face=k/3;tri.getMidpoint(mid);tri.getNormal(normal);
    }
    check(face>=0,`No nondegenerate triangle in slot ${i}`);
    if(material.side===T.BackSide)normal.negate();
    const epsilon=scale*1e-4;
    return {i,owner,lo,hi,face,ray:new T.Raycaster(mid.addScaledVector(normal,epsilon),normal.negate(),0,2*epsilon)};
  });
  check(new Set(rows.map(r=>r.i)).size===rows.length,'Repeated or aliased consumer slot');
  const hits=(r,ray)=>{
    const result=ray.intersectObject(r.owner,false);
    check(result.every(x=>x.faceIndex*3>=r.lo&&x.faceIndex*3<r.hi),`Ray escaped material range ${r.i}`);
    return result.map(x=>x.faceIndex).sort((a,b)=>a-b);
  };
  if(!rows.some(r=>r.owner===mesh))check(!rows[0].ray.intersectObject(mesh,false).length,'Logical source stole a proxy/body ray');
  return rows.map((r,j)=>{
    const own=hits(r,r.ray);check(own.includes(r.face),`Real ray missed witness in slot ${r.i}`);
    const neighbor=rows[(j+1)%rows.length],cross=hits(r,neighbor.ray);
    // The same ray positively hits the neighbour in its own iteration. On
    // source-index proxies its triangle must not leak into this result.
    if(!split.length)check(!cross.includes(neighbor.face),`Ray accepted neighbour face in slot ${r.i}`);
    return {slot:r.i,start:r.lo,end:r.hi,face:r.face,own,cross};
  }).sort((a,b)=>a.slot-b.slot);
}

function topology(surface){
  const roles={},geos=new Map();surface.root.traverse(o=>{if(!o.isSkinnedMesh)return;const r=role(o);roles[r]=(roles[r]??0)+1;
    const g=o.geometry,owners=geos.get(g.id)??[];owners.push([r,slot(o)??null]);geos.set(g.id,owners);});
  const splits=(surface.mesh.userData.mmdMorphSplitBodyMeshes??[]).map(o=>({slot:slot(o),vertices:o.geometry.attributes.position.count,indices:o.geometry.index.count,targets:[...o.userData.mmdMorphSplitBody.morphTargetIndices]}));
  return {roles,splits,geometryOwners:Object.fromEntries(geos)};
}

// Freeze a freshly rendered caster's depth map, then draw ONLY the receiver
// with the actor hidden. The empty control refreshes the map with no caster;
// an independent single-garment caster must imprint a different silhouette.
function shadows(b,surface,frame,garment){
  frame.ground();const {renderer:r}=b,{root}=surface,result={};
  const casters=[];root.traverse(o=>{if(o.isMesh&&o.castShadow)casters.push(o);});
  function imprint(){b.draw(false);r.shadowMap.autoUpdate=false;root.visible=false;
    try{return b.draw();}finally{root.visible=true;r.shadowMap.autoUpdate=true;}}
  try{
    result.shadowWhole=imprint();for(const o of casters)o.castShadow=slot(o)===garment;
    result.shadowGarment=imprint();root.visible=false;result.shadowEmpty=b.draw();
    return result;
  }finally{root.visible=true;for(const o of casters)o.castShadow=true;r.shadowMap.autoUpdate=true;frame.whole();}
}

function footprint(m){const {geometries,textures,arrays,arrayBytes}=m;return {geometries,textures,arrays,arrayBytes};}
async function arm(b,shared,pmx,files,config,out,gate){
  const {scene,renderer,camera,light}=b,frames={};out.counts={empty:b.memory()};
  const rt=createMmdRuntimeHandle(scene,{
    prepareModel:root=>shared?prepareMmdVrModel(root):prepareMmdVrModel(root,{shareMorphGeometry:false}),
    prepareGpu:(...args)=>prepareModelGpu(renderer,scene,camera,...args),
  });
  const add=()=>rt.addModel(pmx,files,{physics:false,transform:{scale:1,positionX:0}}),tick=t=>rt.update(t,false,camera,1,false,0);
  try{
    const loaded=await add(),id=loaded.modelId,surface=rt.getModelSurface(id),mesh=surface.mesh;
    out.topology=topology(surface);out.missingTextures=loaded.missingTextures.length;
    gate('all referenced textures resolved',!out.missingTextures);
    gate('right topology',config.expectSplit?out.topology.splits.length>1:!out.topology.splits.length&&out.topology.roles.material>1);
    const w=rt.getWardrobe(id,pmx);out.wardrobe=w.slots.map(s=>[s.index,s.triangles,s.textured]);
    if(config.expectedWardrobe!=null)gate('drawable wardrobe slots',w.slots.length===config.expectedWardrobe);
    const clothing=w.slots.filter(s=>w.pieces.some(p=>p.kind==='clothing'&&p.key===s.key)).sort((a,b)=>b.triangles-a.triangles);
    const piece=config.clothingSlot==null?clothing[0]:clothing.find(s=>s.index===config.clothingSlot);
    check(piece,'No selected authored clothing slot in the wardrobe');out.clothingSlot=piece.index;
    const track=expressionTrack(config,mesh),frame=framing(b,surface,track.index);out.expression={index:track.index,movingDraws:frame.movingDraws};
    rt.setLighting({envIntensity:0,ambientIntensity:.65,directionalLight:light});
    frame.whole();tick(0);frames.still=b.draw();gate('visible dressed actor',coverage(frames.still)>1024);
    out.rays=checkRanges(surface,frame.h);if(config.expectedRanges!=null)gate('all material ranges',out.rays.length===config.expectedRanges);
    const outlines=[];surface.root.traverse(o=>{if(role(o)==='outline'&&o.visible)outlines.push(o);});
    if(outlines.length){try{for(const o of outlines)o.visible=false;frames.noOutline=b.draw();}finally{for(const o of outlines)o.visible=true;}}
    await rt.loadMotion(track.file,'face',id);frame.close();out.expression.weights=[];
    for(const [t,key] of ['neutral','half','full','zero'].entries()){
      tick(t);frames[key]=b.draw();out.expression.weights.push(mesh.morphTargetInfluences[track.index]);
    }
    gate('actual face-track weights',same(out.expression.weights,[0,.5,1,0]));
    frame.whole();tick(0);frames.clothed=b.draw();rt.setMaterialVisible(id,piece.key,false);tick(0);frames.hidden=b.draw();
    rt.setMaterialVisible(id,piece.key,true);tick(0);frames.restored=b.draw();
    Object.assign(frames,shadows(b,surface,frame,piece.index));
    out.controls={};
    for(const [x,y,min] of [['neutral','half',24],['half','full',24],['neutral','full',24],['neutral','zero',0],
      ['clothed','hidden',64],['clothed','restored',0],['shadowEmpty','shadowWhole',256],['shadowEmpty','shadowGarment',64],['shadowWhole','shadowGarment',64],
      ...(frames.noOutline?[['still','noOutline',config.requireOutline===false?null:1]]:[])]){
      const key=`${x}/${y}`,d=out.controls[key]=difference(frames[x],frames[y]);
      if(min!=null)gate(key,min?d.over8>=min:d.changed===0);
    }
    gate('empty shadow control clear',coverage(frames.shadowEmpty)===0);
    out.programs=b.programs();out.counts.one=b.memory();const first=out.counts.one;
    gate('attributed morph stores',first.arrays>0&&first.atlases.every(t=>out.topology.geometryOwners[t.geometry]));
    const expected=shared?config.expectedNewArrays:config.expectedOldArrays;if(expected!=null)gate('expected live array count',first.arrays===expected);
    if((shared&&config.pair!==false)||(!shared&&config.oldPair)){
      // A different expression on the second instance rules out comparing
      // the removed actor with itself. Only the survivor should remain live.
      const second=await add(),other=second.modelId,otherMesh=rt.getModelSurface(other).mesh;
      await rt.loadMotion(track.file,'face',other);rt.clearMotion(id,'face');frame.close();tick(2);b.draw(false);
      out.counts.two=b.memory();const two=out.counts.two;
      gate('two independent expressions',mesh.morphTargetInfluences[track.index]===0&&otherMesh.morphTargetInfluences[track.index]===1);
      gate('two actor atlases',two.arrayBytes===2*first.arrayBytes&&two.arrays===2*first.arrays);
      const retained=two.atlases.filter(a=>!first.atlases.some(f=>f.allocation===a.allocation)).map(a=>a.allocation);
      rt.removeModel(id);tick(2);frames.survivor=b.draw();out.counts.retained=b.memory();
      out.controls.retained=difference(frames.full,frames.survivor);
      gate('survivor image',out.controls.retained.changed===0);
      gate('survivor live resources',same(footprint(first),footprint(out.counts.retained))&&same(retained,out.counts.retained.atlases.map(a=>a.allocation)));
      rt.removeModel(other);
    }else rt.removeModel(id);
    frame.ground();b.draw(false);out.counts.cleared=b.memory();gate('empty renderer baseline restored',same(footprint(out.counts.empty),footprint(out.counts.cleared)));
    return frames;
  }finally{rt.dispose();b.floor.visible=true;}
}

let bench,busy=false;
window.testAtlas=async(config={})=>{
  check(!busy,'A parity run is already active');busy=true;
  const result={id:config.id??'manual',pass:false,failures:[],old:{},candidate:{},pixels:{}};
  try{
    const folder=document.querySelector('#folder').files,files=[...(folder.length?folder:document.querySelector('#loose').files)];
    const matches=files.filter(f=>config.fileName?f.name===config.fileName:/\.pmx$/i.test(f.name));
    check(matches.length===1,'Select one unambiguous PMX entry in its texture folder');const pmx=matches[0];
    if(config.sha256){const digest=await crypto.subtle.digest('SHA-256',await pmx.arrayBuffer());
      check(Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')===config.sha256,'Private plan PMX content changed');}
    bench??=createBench();result.device=bench.device;
    const gate=(section,label,ok)=>{if(!ok)result.failures.push(`${section}: ${label}`);};
    note(`${result.id} · 旧路径`);const old=await arm(bench,false,pmx,files,config,result.old,(...a)=>gate('old',...a));
    note(`${result.id} · 默认路径`);const next=await arm(bench,true,pmx,files,config,result.candidate,(...a)=>gate('candidate',...a));
    for(const key of Object.keys(old)){const d=result.pixels[key]=difference(old[key],next[key]);gate('pixels',key,d.changed===0);}
    for(const k of ['roles','splits'])gate('retained topology',k,same(result.old.topology[k],result.candidate.topology[k]));
    for(const k of ['rays','wardrobe','expression'])gate('parity',k,same(result.old[k],result.candidate[k]));
    const a=result.old.counts.one,b=result.candidate.counts.one;
    result.storage={oldBytes:a.arrayBytes,newBytes:b.arrayBytes,savedMiB:(a.arrayBytes-b.arrayBytes)/2**20};
    const requireReduction=!config.expectSplit||config.requireReduction;
    gate('morph storage',requireReduction?'demonstrated reduction':'compact stores never grow',requireReduction?b.arrayBytes<a.arrayBytes:b.arrayBytes<=a.arrayBytes);
    result.pass=result.failures.length===0;
  }catch(e){result.failures.push(String(e?.stack??e));}finally{busy=false;note(result.pass?'通过':'未通过');document.querySelector('#report').textContent=JSON.stringify(result,null,2);document.querySelector('#save').disabled=false;}
  return result;
};
for(const [input,other] of [['#folder','#loose'],['#loose','#folder']])document.querySelector(input).onchange=e=>{document.querySelector(other).value='';document.querySelector('#model').replaceChildren(...Array.from(e.target.files).filter(f=>/\.pmx$/i.test(f.name)).map(f=>new Option(f.name,f.name)));};
document.querySelector('#run').onclick=async e=>{const button=e.currentTarget;button.disabled=true;try{const value=document.querySelector('#slot').valueAsNumber;await window.testAtlas({fileName:document.querySelector('#model').value,expectSplit:document.querySelector('#kind').value==='split',clothingSlot:Number.isFinite(value)?value:undefined});}finally{button.disabled=false;}};
window.addEventListener('pagehide',()=>bench?.dispose(),{once:true});
document.querySelector('#save').onclick=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([document.querySelector('#report').textContent],{type:'application/json'}));a.download='atlas-parity.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
