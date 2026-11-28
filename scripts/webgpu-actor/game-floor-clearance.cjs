const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');

async function observe({id,slots}){
  const {fullReference,invalidateMmdTslSparseMorphOutputs}=await import('/scripts/webgpu-actor/sparse-morph-observer.js');
  const {useBackpack}=await import('/src/mmdVrShowcase/backpack/store.ts');
  const {authoredSurface}=await import('/src/mmdVrShowcase/play/authoredSurface.ts');
  const {ClothCrossing}=await import('/src/mmdVrShowcase/mmdRuntime/clothCrossing.ts');
  const {scene,gl}=gameTargets.floorState(),rid=useBackpack.getState().live[id].runtimeId,origin=gl.xr.getCamera().parent;
  let mesh;scene.traverse(o=>{if(o.userData.mmdModelId===rid&&authoredSurface.has(o))mesh=o;});
  const output=mesh.geometry.attributes.position,source=authoredSurface.get(mesh);
  if(source.position===output||!output.isStorageBufferAttribute)throw Error('Take needs actual GPU sparse positions');
  const bones=mesh.skeleton.bones,permitted=new Set(mesh.userData.mmdPhysics.rigidBodies.filter(b=>b.mode!=='static'&&
    /skirt|スカート|裙/i.test([b.name,b.englishName,bones[b.boneIndex]?.name].join(' '))).map(b=>b.boneIndex));
  const hip=bones.find(b=>[b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].some(n=>/^(hips?|lower body|下半身|pelvis)$/i.test(n??'')));
  const {skinIndex,skinWeight}=mesh.geometry.attributes;
  const native=gl.compute,device=gl.backend.device;let saved,copyRaw=false,passes=0,clearance;
  function copy(from,to){const e=device.createCommandEncoder();e.copyBufferToBuffer(from,0,to,0,from.size);device.queue.submit([e.finish()]);}
  gl.compute=function(node,...rest){if(node?.name==='Manual pose skirt clearance'){
     clearance=node;passes++;if(copyRaw){const buffer=gl.backend.get(output).buffer;
      saved??=device.createBuffer({size:buffer.size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.COPY_SRC});copy(buffer,saved);}}
    return native.call(this,node,...rest);};
  const pictures={},states={};
  // Read back sparse positions and skin them with the captured SAME frame's
  // matrices. Count across the original leg draw separately for each sheet.
  function crossings(state){
    if(!slots)return;
    const {geometry:g}=mesh,ix=g.index,cache=new Map(),skin=new ClothCrossing();
    const inv=mesh.matrixWorld.clone().invert(),origin=hip.getWorldPosition(mesh.position.clone());
    const transforms=bones.map((_,i)=>inv.clone().fromArray(state.matrices,16*i).multiply(mesh.skeleton.boneInverses[i]));
    const legBones=new Set(bones.flatMap((b,i)=>[b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].some(n=>/^(?:[左右](?:足|ひざ|膝)|(?:left|right)[ _]?(?:thigh|shin|knee|upleg|upperleg|lowerleg))d?$/i.test(n??''))?[i]:[]));
    const point=i=>{let p=cache.get(i);if(p)return p;
      if(g.attributes.matricesSdefEnabled?.getX(i)||g.attributes.matricesQdefEnabled?.getX(i))throw Error('Capture needs a linear test surface');
      const rest=mesh.position.clone().fromArray(state.p,i*state.stride).applyMatrix4(mesh.bindMatrix);p=mesh.position.clone().set(0,0,0);
      for(let k=0;k<4;k++){const w=skinWeight.getComponent(i,k);if(w)p.addScaledVector(rest.clone().applyMatrix4(transforms[skinIndex.getComponent(i,k)]),w);}
      p.applyMatrix4(mesh.bindMatrixInverse).applyMatrix4(mesh.matrixWorld).sub(origin).multiplyScalar(2.5);cache.set(i,p);return p;};
    function visit(slot,allowed,inspect){let drawn=0;
      for(const gr of g.groups){if(gr.materialIndex!==slot||![mesh.material].flat()[slot]?.visible)continue;
        for(let j=gr.start;j<gr.start+gr.count;j+=3){const ids=[ix.getX(j),ix.getX(j+1),ix.getX(j+2)];let w=0;
          for(const i of ids)for(let k=0;k<4;k++)if(allowed.has(skinIndex.getComponent(i,k)))w+=skinWeight.getComponent(i,k);
          if(w<1.5)continue;inspect(...ids.map(point));drawn++;}}
      if(!drawn)throw Error('Missing weighted, visible reference surface');return drawn;}
    visit(slots.leg,legBones,(...v)=>skin.add(...v));const count={};
    for(const [key,slot] of Object.entries(slots)){if(key==='leg')continue;let hits=0;
      const triangles=visit(slot,permitted,(...v)=>{if(skin.crosses(...v))hits++;});count[key]={triangles,hits};}return count;
  }
  function compare(){const a=states.corrected,b=states.raw;let points=0,leaked=0,peak=0,boneDrift=0;
    for(let i=0;i<a.matrices.length;i++)boneDrift=Math.max(boneDrift,Math.abs(a.matrices[i]-b.matrices[i]));
    for(let i=0;i<output.count;i++){const k=i*a.stride,d=Math.hypot(b.p[k]-a.p[k],b.p[k+1]-a.p[k+1],b.p[k+2]-a.p[k+2]);
      if(d<1e-5)continue;peak=Math.max(peak,d);points++;let w=0;for(let j=0;j<4;j++)if(permitted.has(skinIndex.getComponent(i,j)))w+=skinWeight.getComponent(i,j);if(w<.46)leaked++;}
    const eyes=pictures.corrected.map((im,i)=>{const raw=pictures.raw[i];let n=0;
      for(let y=Math.floor(im.height*.15);y<im.height*.86;y++)for(let x=Math.floor(im.width*.1);x<im.width*.90;x++){
        const k=4*(y*im.width+x);if([0,1,2].some(c=>Math.abs(raw.data[k+c]-im.data[k+c])>6))n++;}return n;});
     return {points,leaked,peak,boneDrift,eyes,correctedReference:match('corrected','reference'),steps:[a.steps,b.steps],modes:[a.mode,b.mode],passes,rawCrossings:crossings(b),correctedCrossings:crossings(a)};}
  function match(actual,reference){return pictures[actual].map((im,eye)=>{const other=pictures[reference][eye].data;let changed=0;
    for(let i=0;i<im.data.length;i+=4)if(im.data[i]!==other[i]||im.data[i+1]!==other[i+1]||im.data[i+2]!==other[i+2])changed++;
    return changed;});}
  function restError(){const p=states.restored.p,stride=states.restored.stride;let max=0;
    if(mesh.morphTargetInfluences.some(w=>w!==0))throw Error('Expected original neutral PMX for restoration control');
    const pos=source.position;for(let i=0;i<pos.count;i++){const j=i*stride;max=Math.max(max,Math.abs(p[j]-pos.getX(i)),Math.abs(p[j+1]-pos.getY(i)),Math.abs(p[j+2]-pos.getZ(i)));}return max;}
  // Draw the SAME evaluated frame again with its pre-clearance GPU positions.
  // Even with a held clock, the native pose display can settle between ticks.
  async function capture(...tags){const cfg=labFixture,oldX=cfg.headX,center=origin.worldToLocal(hip.getWorldPosition(mesh.position.clone()));
    if(cfg.take)throw Error('Overlapping pose take');cfg.headX=center.x+.21;
    const jobs=[];await new Promise((resolve,reject)=>{let n=0;
      const end=()=>{clearTimeout(timer);cfg.take=null;cfg.headX=oldX;copyRaw=false;};
      const timer=setTimeout(()=>{end();reject(Error('No matched pose frames'));},25000);
      cfg.take={time:performance.now(),eyeY:center.y+.19,eyeZ:center.z+.63,eyeYaw:.32,eyePitch:-.30,inputs(){copyRaw=n===2&&tags.includes('raw');},afterDraw(s){try{
        n++;if(n<3)return;const status=stageProbe.read().actor,buffer=gl.backend.get(output).buffer;
        const stride=buffer.size/output.count/4;
        if(stride!==4&&stride!==3)throw Error('Unexpected sparse stride');
         for(const tag of tags){
           if(tag==='reference'||tag==='clean-reference'){
             fullReference(gl,mesh);
             if(tag==='reference'){invalidateMmdTslSparseMorphOutputs(mesh);native.call(gl,clearance);}
             gl.render(scene,gameTargets.floorState().camera);
           }
           if(tag==='raw'){if(!saved)throw Error('No corrected skirt on this frame');invalidateMmdTslSparseMorphOutputs(mesh);copy(saved,buffer);gl.render(scene,gameTargets.floorState().camera);}
          const matrices=bones.flatMap(b=>[...b.matrixWorld.elements]);
          jobs.push(Promise.all([s.copyEyes(),gl.getArrayBufferAsync(output)]).then(([pair,bytes])=>{
            pictures[tag]=pair;states[tag]={p:new Float32Array(bytes),matrices,stride,steps:status.clothSteps,mode:status.mode};}));
        }
        end();resolve();
      }catch(e){end();reject(e);}}};});await Promise.all(jobs);}
  function sheet(){const tags=['raw','corrected','restored'],{width,height}=pictures.raw[0],c=document.createElement('canvas');c.width=width*2;c.height=height*tags.length;
    tags.forEach((tag,y)=>pictures[tag].forEach((im,x)=>c.getContext('2d').putImageData(im,x*width,y*height)));return c.toDataURL().split(',')[1];}
  window.clearanceTake={capture,compare,match,restError,sheet,get passes(){return passes;},dispose(){gl.compute=native;saved?.destroy();delete window.clearanceTake;}};
}

module.exports=async function({page,ids,bButton,click,until,target,pickMounted,aim,trigger,frames,idleRay}){
  const actor=await until('ready for sparse posing',s=>s.ready&&s.selected&&s.actor?.evaluations>0);
  // Run this phase before binding a VMD; the restored neutral PMX is an
  // independent bit-for-bit control for every vertex of the GPU output.
  assert(!actor.hasBinding,'Run clearance before the dance phases');
  if(!actor.physics){await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
    await until('physics on',s=>s.ready&&s.physics);await click('hudBack');await target({name:'watch:quiet'});await pickMounted(ids.model);}
  const press=async txt=>{await aim(await target({name:'hud:'+txt}));await trigger(true);await trigger(false);};
  const slots=process.env.POSE_SKIRT_SLOTS&&JSON.parse(process.env.POSE_SKIRT_SLOTS);
  await page.evaluate(observe,{id:ids.model,slots});
  try{
    await click('actorPose');await press('快速体位');await press('四点跪撑');await press('保留姿势并返回');await click('hudDone');
    await target({name:'watch:quiet'});await idleRay();await frames(72);
    await until('authored sparse hem and full native world on the held pose',s=>s.actor.mode==='bullet'&&s.actor.fullBodies===s.actor.keptBodies&&clearanceTake.passes>0);
     const result=await page.evaluate(async()=>{await clearanceTake.capture('corrected','reference','raw');return clearanceTake.compare();});
     assert.deepEqual(result.correctedReference,[0,0],'Corrected skirt differs from full recompute in the same eyes');
    assert(result.points>0&&!result.leaked&&result.eyes.every(n=>n>3)&&result.boneDrift<1e-5&&result.steps[0]===result.steps[1],JSON.stringify(result));
    await pickMounted(ids.model);await click('actorPose');await press('恢复原动作');await click('hudDone');await target({name:'watch:quiet'});await idleRay();
     await until('original free cloth resumes',s=>s.actor.mode==='gpu');await page.evaluate(()=>clearanceTake.capture('restored','clean-reference'));
     result.restoredReference=await page.evaluate(()=>clearanceTake.match('restored','clean-reference'));assert.deepEqual(result.restoredReference,[0,0]);
    result.residual=await page.evaluate(()=>clearanceTake.restError());assert.equal(result.residual,0);
    const dir=path.resolve('local-review/screenshots/pose-and-contact');await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(dir,'skirt-stereo.png'),Buffer.from(await page.evaluate(()=>clearanceTake.sheet()),'base64'));
    await pickMounted(ids.model);return result;
  }finally{await page.evaluate(()=>window.clearanceTake?.dispose());}
};
