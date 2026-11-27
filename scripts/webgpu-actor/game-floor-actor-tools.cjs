const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');

// Run inside game-floor-smoke's mounted floor. Only the normal XR buttons and
// target rays edit anything. Capture actual submitted views of the figure and
// actor with an omitted-draw control to exclude text, pointers and scenery.
async function observe(asset){
  const {useBodyState}=await import('/src/mmdVrShowcase/bodyState/store.ts');
  const {useConception}=await import('/src/mmdVrShowcase/bodyState/reproduction/store.ts');
  const {usePelvic}=await import('/src/mmdVrShowcase/pelvic/store.ts');
  const {useMmdVrStore}=await import('/src/mmdVrShowcase/mmdVrStore.ts');
  const {useBackpack}=await import('/src/mmdVrShowcase/backpack/store.ts');
  const {materialSlotKeys}=await import('/src/mmdVrShowcase/mmdRuntime/materialSlotKey.ts');
  const floor=gameTargets.floorState(), {scene,gl}=floor;
  const id=useBackpack.getState().live[asset].runtimeId;
  let mesh;scene.traverse(n=>{if(n.isSkinnedMesh&&n.userData.mmdModelId===id&&n.userData.mmdMorphs)mesh=n;});
  if(!mesh)throw Error('No rendered PMX on the selected actor');
  const mats=[mesh.material].flat(),keys=materialSlotKeys(mats.filter(m=>!m.userData.mmdTslOutlineMaterial));
  const fig=()=>scene.getObjectByName('body:breast-observation');
  const read=()=>{
    const b=useBodyState.getState(),p=usePelvic.getState(),s=p.support[asset];
    return {saved:b.byAsset[asset]??null,draft:b.draft?.value??null,bones:b.support[asset]?.bones??false,
      pelvic:p.byAsset[asset]??null,eggs:useConception.getState().byAsset[asset]??null,active:p.active??null,
      obstruction:s?.obstruction??null,blocker:s?.blockerName??null,angle:fig()?.material.map?.image?.dataset.angle,
      root:mesh.matrixWorld.toArray(),pose:Array.from(mesh.skeleton.boneMatrices),weights:[...mesh.morphTargetInfluences],
      eyes:gl.xr.getCamera().cameras.map(c=>c.matrixWorld.toArray())};
  };
  const materialState=key=>{
    const i=keys.indexOf(key);if(i<0)throw Error('Blocker is not an authored slot');
    return {enabled:useMmdVrStore.getState().materialModels[id].find(m=>m.name===key)?.visible,
      draws:mats.filter((m,j)=>j===i||m.userData.mmdTslOutlineMaterial?.sourceMaterialIndex===i).map(m=>({shown:m.visible,opacity:m.opacity}))};
  };
  const pictures=new Map();
  function picture(label,subject){
    const object=subject==='figure'?fig():mesh,cfg=labFixture,oldX=cfg.headX;
    if(!object?.visible||cfg.take)throw Error('Missing subject or overlapping eye capture: '+label);
    const origin=gl.xr.getCamera().parent;
    let at;
    if(subject==='figure')at=object.getWorldPosition(object.position.clone());
    else {
      const live=useBackpack.getState().live[asset],h=live.bounds.size[1];
      at=mesh.position.clone().fromArray(live.position);
      at.y+=h*(subject==='garment'?.49:.72);
    }
    origin.worldToLocal(at);
    // The HUD has depth testing disabled. Stand between it and the shoulder,
    // looking *away* from the sheet: a newly expanded receipt would otherwise
    // cover the actor even if the rectangle was physically behind its back.
    const distance=subject==='figure'?.86:subject==='chest'?.20:.74;
    const panel=scene.getObjectByName('backpack-world-tools');
    const panelX=origin.worldToLocal(panel.getWorldPosition(at.clone())).x;
    const dx=subject==='figure'?0:subject==='chest'?.56*(panelX>=at.x?1:-1):-.27;
    cfg.headX=at.x+dx;
    const finish=(timer)=>{clearTimeout(timer);cfg.take=null;cfg.headX=oldX;object.visible=true;};
    return new Promise((resolve,reject)=>{
      let drawn,frames=0;
      const timer=setTimeout(()=>{finish(timer);reject(Error('No stereo output: '+label));},20000);
      cfg.take={eyeY:at.y,eyeZ:at.z+distance,eyeYaw:Math.atan2(dx,distance),inputs(){this.time=performance.now();},afterDraw(s){
        try{
          if(++frames<3)return;
          if(!drawn){drawn=s.copyEyes();object.visible=false;return;}
          const blank=s.copyEyes();finish(timer);
          Promise.all([drawn,blank]).then(([eyes,control])=>{
            pictures.set(label,{eyes,control});
            const canvas=document.createElement('canvas');canvas.width=eyes[0].width*2;canvas.height=eyes[0].height;
            eyes.forEach((im,i)=>canvas.getContext('2d').putImageData(im,i*im.width,0));resolve(canvas.toDataURL().split(',')[1]);
          }).catch(reject);
        }catch(e){finish(timer);reject(e);}
      }};
    });
  }
  function compare(first,second){
    const a=pictures.get(first),b=pictures.get(second);
    return a.eyes.map((im,eye)=>{
      let changed=0,drawn=0,total=0;
      const color=b.eyes[eye].data,blankA=a.control[eye].data,blankB=b.control[eye].data;
      for(let y=6;y<im.height-6;y++)for(let x=5;x<im.width-5;x++){
        const k=(y*im.width+x)*4;let observed=false,peak=0,sum=0;
        for(let c=0;c<3;c++){
          observed||=Math.abs(im.data[k+c]-blankA[k+c])>8||Math.abs(color[k+c]-blankB[k+c])>8;
          const d=Math.abs(im.data[k+c]-color[k+c]);peak=Math.max(peak,d);sum+=d;
        }
        if(observed){drawn++;total+=sum;if(peak>8)changed++;}
      }
      return {drawn,changed,total};
    });
  }
  window.actorToolsTake={read,materialState,picture,compare};
}

module.exports=async function({page,ids,click,until,bButton,frames,target,pickMounted,aim,trigger,idleRay}){
  const actor=await until('selected clothed actor',s=>s.ready&&s.selected&&s.actor?.evaluations>0,null,120000);
  if(actor.physics){
    await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
    await until('still standing pose',s=>s.ready&&!s.physics&&s.actor.mode==='none');
    await click('hudBack');await target({name:'watch:quiet'});await pickMounted(ids.model);
  }
  await page.evaluate(observe,ids.model);
  const read=()=>page.evaluate(()=>actorToolsTake.read());
  const wait=async(fn,arg)=>{await(await page.waitForFunction(fn,arg,{timeout:45000})).dispose();};
  const press=async(label)=>{await aim(await target({name:'hud:'+label}));await trigger(true);await trigger(false);};
  const dir=path.join(__dirname,'../../local-review/screenshots/webgpu-actor-tools');await fs.mkdir(dir,{recursive:true});
  async function take(label,subject){
    await idleRay();await frames(3);
    const png=await page.evaluate(([label,subject])=>actorToolsTake.picture(label,subject),[label,subject]);
    await fs.writeFile(path.join(dir,label+'.png'),Buffer.from(png,'base64'));await frames(3);
  }
  async function compare(a,b,restored=false){
    const result=await page.evaluate(([a,b])=>actorToolsTake.compare(a,b),[a,b]);
    assert(result.every(e=>e.drawn>128&&(restored?e.total===0:e.changed>12)),`${a} → ${b}: ${JSON.stringify(result)}`);return result;
  }
  const before=await read();assert(!before.saved&&!before.draft&&!before.pelvic,'Expected fresh actor tools');
  // Independent observation: drag the actual figure, not a state setter.
  await click('actorObservation');await press('定格图像');await press('正面');
  await wait(()=>actorToolsTake.read().angle==='0');await take('figure-front','figure');
  const drag=await page.evaluate(()=>{
    const handle=gameTargets.floorState().scene.getObjectByName('actor:turn-figure');
    return [0,.24].map(x=>handle.localToWorld(handle.position.clone().set(x,0,0)).toArray());
  });
  await aim(drag[0]);await trigger(true);await aim(drag[1]);await trigger(false);
  await wait(()=>Number(actorToolsTake.read().angle)>20);await take('figure-turned','figure');
  const turned=await read(),observation=await compare('figure-front','figure-turned');
  for(const field of ['saved','draft','eggs','pelvic','active','root','pose','weights','eyes'])assert.deepEqual(turned[field],before[field],`Reading the figure changed ${field}`);
  await press('正面');await press('播放图像');await click('actorBack');

  // Use the actual fitted obstruction. For layered outfits a second garment
  // can still block the same opening after the outer garment disappears.
  await click('actorInsert');await press('成年角色入口设置');await press('模型');
  await wait(()=>actorToolsTake.read().obstruction==='garment');const key=(await read()).blocker;
  await press('调整服装');await target({name:'wardrobe-hud'});await target({name:'hud-label:'+key});
  const material=()=>page.evaluate(key=>actorToolsTake.materialState(key),key),original=await material();
  assert(original.enabled&&original.draws[0].shown);await take('dressed','garment');
  await press('隐藏此件');await wait(key=>{const r=actorToolsTake.read();return r.obstruction!=='unverified'&&r.blocker!==key;},key);
  assert(!(await material()).draws.some(m=>m.shown));await take('garment-hidden','garment');
  const nextLayer=(await read()).obstruction,wardrobe=await compare('dressed','garment-hidden');
  await press('恢复原装');await wait(key=>actorToolsTake.read().blocker===key,key);
  assert.deepEqual(await material(),original);await take('garment-restored','garment');
  const outfitRestoration=await compare('dressed','garment-restored',true);
  await click('backToInsert');await press('调整入口');await press('模型');await press('删除此角色的附件设置');await click('actorBack');

  await click('actorBodyState');await wait(()=>actorToolsTake.read().bones);
  await take('shape-original','chest');const shapeBase=await read();
  const slider=await page.evaluate(()=>{
    let hit;gameTargets.floorState().scene.getObjectByName('body:actor-tools').traverse(m=>{if(m.renderOrder===33&&m.geometry?.type==='PlaneGeometry')hit=m;});
    if(!hit)throw Error('Missing fullness slider');return hit.localToWorld(hit.position.clone().set(hit.geometry.parameters.width*.45,0,0)).toArray();
  });
  async function preview(){await aim(slider);await trigger(true);await trigger(false);await wait(()=>actorToolsTake.read().draft?.fullness>=.9);}
  await preview();await take('shape-preview','chest');assert.equal((await read()).saved,null);
  const shape=await compare('shape-original','shape-preview');
  await press('放弃改动');await wait(()=>!actorToolsTake.read().draft);await take('shape-discarded','chest');
  const canceled=await read();for(const k of ['saved','draft','weights','pose','root','eyes'])assert.deepEqual(canceled[k],shapeBase[k],`Discard changed ${k}`);
  const discard=await compare('shape-original','shape-discarded',true);
  await preview();await press('保存到角色');await wait(()=>actorToolsTake.read().saved?.fullness>=.9&&!actorToolsTake.read().draft);
  await take('shape-saved','chest');const save=await compare('shape-preview','shape-saved',true);
  await press('撤销保存');await wait(()=>!actorToolsTake.read().saved&&!actorToolsTake.read().draft);
  await take('shape-undone','chest');const undo=await compare('shape-original','shape-undone',true);
  await click('actorBack');await target({key:'actorWardrobe'});await idleRay();
  const end=await read();for(const k of ['saved','draft','eggs','pelvic','active','pose','root','weights'])assert.deepEqual(end[k],before[k],`Unrestored ${k}`);
  await until('restored selected actor on its first sheet',(s,id)=>s.ready&&s.visible&&s.selected&&s.runtimeId===id&&!s.playing,actor.runtimeId);
  await page.evaluate(()=>{delete window.actorToolsTake;});
  return {observation,angle:Number(turned.angle),wardrobe,draws:original.draws.length,remainingObstruction:nextLayer,outfitRestoration,shape,discard,save,undo};
};
