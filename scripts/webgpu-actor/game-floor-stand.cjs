const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');

// Read the selected authored vertex from the storage buffer actually used by
// this room's draw after compute. Attribute.array is not GPU output.
async function observeOpeningVertex(id){
  const {usePelvic}=await import('/src/mmdVrShowcase/pelvic/store.ts');
  const {useBackpack}=await import('/src/mmdVrShowcase/backpack/store.ts');
  const {positionMorphs}=await import('/scripts/webgpu-actor/positionMorphs.js');
  const {scene,gl}=gameTargets.floorState(),bag=useBackpack.getState(),actor=bag.live[id];
  let mesh;
  scene.traverse(o=>{if(o.userData.mmdModelId===actor.runtimeId)o.traverse(m=>{if(m.isSkinnedMesh&&m.userData.mmdMorphs)mesh??=m;});});
  const position=mesh.geometry.attributes.position,index=mesh.morphTargetDictionary[usePelvic.getState().byAsset[id].apertureMorph];
  const bytes=await bag.entries.find(e=>e.id===id).file.arrayBuffer();
  const morph=[...positionMorphs(bytes,position.count)].find(m=>m.index===index);
  const drawn=new Uint8Array(position.count),g=mesh.geometry;
  for(const {materialIndex,start,count} of g.groups){const m=[mesh.material].flat()[materialIndex??0];
    if(!m?.visible||!m.colorWrite||m.userData.mmdTslOutlineMaterial)continue;
    for(let i=start;i<start+count;i++)drawn[g.index?.getX(i)??i]=1;
  }
  let vertex=-1,magnitude=0,delta;
  for(let r=morph.count-1;r>=0;r--){const i=morph.vertex(r);if(!drawn[i])continue;drawn[i]=0;
    const v=[morph.component(r,0),morph.component(r,1),-morph.component(r,2)],length=Math.hypot(...v);
    if(length>magnitude){vertex=i;magnitude=length;delta=v;}
  }
  if(vertex<0)throw Error('No drawn nonzero vertex in selected shape');
  window.openingVertex=()=>new Promise((resolve,reject)=>{
    if(labFixture.take){reject(Error('Overlapping GPU captures'));return;}
    const timeout=setTimeout(()=>{labFixture.take=null;reject(Error('Missing XR submission for morph'));},15000);
    labFixture.take={inputs(){this.time=performance.now();},afterDraw(){clearTimeout(timeout);labFixture.take=null;
      try{const stride=gl.backend.get(position).buffer.size/position.count;
        if(stride!==12&&stride!==16)throw Error('Unknown position buffer stride');
        const weight=mesh.morphTargetInfluences[index];
        gl.getArrayBufferAsync(position,null,vertex*stride,12).then(data=>resolve({p:[...new Float32Array(data)],weight,delta}),reject);
      }catch(e){reject(e);}
    }};
  });
}

// Read the manufactured end on the rendered child, independently of the
// slider, stand group and published sample. A store action is never an input.
async function observeStand(id){
  const {usePelvic}=await import('/src/mmdVrShowcase/pelvic/store.ts');
  const {useStagePlay}=await import('/src/mmdVrShowcase/play/stagePlay.ts');
  const {centerZ,tipHeight}=await import('/src/mmdVrShowcase/play/siliconeProfile.ts');
  const {projectDepth}=await import('/src/mmdVrShowcase/pelvic/path.ts');
  const get=name=>gameTargets.floorState()?.scene.getObjectByName(name);
  const ports=`pelvic:adapter:${id}`,seal='pelvic:seal',part='play:piece:dildo';
  function visible(mesh){if(!mesh)return false;for(let p=mesh;p;p=p.parent)if(!p.visible)return false;return true;}
  function read(){
    const {active,support,byAsset,sample,parkedSample,strokeOrder}=usePelvic.getState(),p=byAsset[id],rod=get(part),port=get(ports);
    const world=rod?.localToWorld(rod.position.clone().set(0,tipHeight,centerZ(tipHeight)));
    const local=world&&port?.worldToLocal(world.clone()),s=sample??parkedSample;
    return {active:active?.mode??null,running:active?.running??false,token:active?.token,order:!!strokeOrder,fluid:p?.fluid,
      kind:support[id]?.kind,blocked:support[id]?.obstruction,confirmed:p?.clothingClear,clothed:p?.clothed,mounted:p?.showAdapter,
      owned:useStagePlay.getState().stand?.assetId===id,rod:visible(rod),rail:visible(get('pelvic:rails')),shell:visible(get(seal)),
      drops:get('play:liquid-spray')?.count??0,home:s?.railHome,inside:s?.outletInside,depth:s?.depth,world:world?.toArray(),
      localZ:local?.z,measured:local&&s?projectDepth(s,local):null,detail:sample?.exteriorCovered,labels:!!get('pelvic:controls'),
      art:get('observation:vagina')?.material.map?.image.getAttribute('aria-label')};
  }
  const receipts=[];let maxDrops=0,coveredShellFrames=0;
  const off=usePelvic.subscribe((s,p)=>{const f=s.byAsset[id]?.fluid,last=p.byAsset[id]?.fluid;
    if(f&&last&&(f.vaginal>last.vaginal||f.fantasyUterine>last.fantasyUterine))receipts.push(read());});
  const {scene,gl}=gameTargets.floorState(),original=scene.onBeforeRender;let mask=null;
  scene.onBeforeRender=function(...args){original.apply(this,args);
    const s=usePelvic.getState();if(s.support[id]?.obstruction&&visible(get(seal)))coveredShellFrames++;
    maxDrops=Math.max(maxDrops,get('play:liquid-spray')?.count??0);
    if(mask)mask.visible=false;
  };
  // The second native submission omits precisely the named draw. Sample the
  // final colour-converted slices and keep the complete stereo images local.
  function capture(name,sheet){
    const cfg=labFixture,m=get(name),port=get(ports);
    if(!visible(m)||cfg.take)throw Error('Missing draw or overlapping take: '+name);
    const at=m.getWorldPosition(m.position.clone());
    const headX=cfg.headX,eyeX=sheet?0:.22,eyeZ=sheet?0:port.getWorldPosition(at.clone()).z+.72;
    const eyeY=sheet?at.y:port.getWorldPosition(at.clone()).y-.06;
    cfg.headX=eyeX;
    return new Promise((resolve,reject)=>{
      let pair,regions,wasVisible=true;
      const reset=()=>{if(mask){mask.visible=wasVisible;mask=null;}cfg.take=null;cfg.headX=headX;clearTimeout(timer);};
      const timer=setTimeout(()=>{reset();reject(Error('Missing XR output: '+name));},15000);
      cfg.take={eyeY,eyeZ,eyeYaw:Math.atan2(eyeX-at.x,eyeZ-at.z),inputs(){this.time=performance.now();},afterDraw(s){try{
        if(!pair){
          m.geometry.computeBoundingBox();const box=m.geometry.boundingBox;
          regions=gl.xr.getCamera().cameras.map(cam=>{const pts=[];
            for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
              const p=m.position.clone().set(x,y,z).applyMatrix4(m.matrixWorld).project(cam);pts.push([(1+p.x)/2,(1-p.y)/2]);}
            return [Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))];});
          pair=s.copyEyes();wasVisible=m.visible;mask=m;return;
        }
        const control=s.copyEyes();reset();Promise.all([pair,control]).then(([images,blank])=>{
          const pixels=images.map(({data,width:w,height:h},i)=>{let n=0;const [x0,y0,x1,y1]=regions[i];
            for(let y=Math.max(5,Math.floor(5+y0*(h-10))-2);y<Math.min(h-5,Math.ceil(5+y1*(h-10))+2);y++)for(let x=Math.max(4,Math.floor(4+x0*(w-8))-2);x<Math.min(w-4,Math.ceil(4+x1*(w-8))+2);x++){
              const k=4*(y*w+x);if([0,1,2].some(c=>Math.abs(data[k+c]-blank[i].data[k+c])>12))n++;
            }return n;});
          const c=document.createElement('canvas');c.width=images[0].width*2;c.height=images[0].height;
          images.forEach((im,i)=>c.getContext('2d').putImageData(im,im.width*i,0));resolve({pixels,png:c.toDataURL('image/png').split(',')[1]});
        }).catch(reject);
      }catch(e){reset();reject(e);}}};
    });
  }
  window.standTake={read,capture,receipts,stats:()=>({maxDrops,coveredShellFrames}),dispose(){scene.onBeforeRender=original;off();}};
}

module.exports=async function({page,ids,click,until,bButton,frames,target,pickMounted,aim,trigger,exposed}){
  const actor=await until('private actor placed',s=>s.ready&&s.selected&&s.actor?.evaluations>0,null,120000);
  if(actor.physics){await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
    await until('held matching pose',s=>s.ready&&!s.physics&&s.actor.mode==='none');await click('hudBack');await target({name:'watch:quiet'});await pickMounted(ids.model);}
  await page.evaluate(observeStand,ids.model);
  const read=()=>page.evaluate(()=>standTake.read()),press=async text=>{await aim(await target({name:'hud:'+text}));await trigger(true);await trigger(false);};
  const wait=async(label,pred)=>{try{await (await page.waitForFunction(`(${pred})(standTake.read())`,null,{timeout:30000})).dispose();}
    catch(e){throw Error(label+': '+JSON.stringify(await read()),{cause:e});}return read();};
  const absent=async labels=>assert(await page.evaluate(labels=>labels.every(n=>!gameTargets.find({name:'hud:'+n})),labels));
  const captures={},save=async(tag,mesh,sheet=false)=>{
    const {pixels,png}=await page.evaluate(([n,s])=>standTake.capture(n,s),[mesh,sheet]);captures[tag]=pixels;
    const dir=path.join(__dirname,'../../local-review/screenshots/floor-stand');await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(dir,`${exposed?'exposed':'covered'}-${tag}.png`),Buffer.from(png,'base64'));
    assert(pixels.every(n=>n>8),`Missing ${tag} in submitted eyes: ${pixels}`);
  };
  await click('actorInsert');await target({name:'observation:uterus'});await press('手动支架');
  const parked=await wait('visible stand and measured home',s=>s.kind==='bones'&&s.owned&&s.rod&&s.rail&&s.home&&s.localZ>.03);
  assert(!parked.inside&&!parked.running);await absent(['推进']);
  // The wider monitor can cover the stand from a frontal close-up. Move it
  // using the same title drag as a player, before taking either eye image.
  const drag=await page.evaluate(()=>{const room=gameTargets.floorState().scene,group=room.getObjectByName('backpack-world-tools'),handle=room.getObjectByName('actor:move-sheet');
    const sign=Math.sign(group.position.x)||1;
    return {start:handle.getWorldPosition(handle.position.clone()).toArray(),end:handle.localToWorld(handle.position.clone().set(sign*1.05,0,0)).toArray(),x:group.position.x};});
  await aim(drag.start);await trigger(true);await aim(drag.end);await trigger(false);
  assert(await page.evaluate(x=>Math.abs(gameTargets.floorState().scene.getObjectByName('backpack-world-tools').position.x-x)>.5,drag.x),'Title drag did not move the monitor away from the rail');
  await save('parked','play:piece:dildo');
  await press('调整入口');
  async function slideFit(label){
    const point=await page.evaluate(label=>{const row=gameTargets.floorState().scene.getObjectByName('hud-label:前后');
      const k=row?.parent?.getObjectByName('hud:'+label);return k?.getWorldPosition(k.position.clone()).toArray();},label);
    assert(point,'Missing authored fit field');await aim(point);await trigger(true);await trigger(false);
  }
  await slideFit('+');const shifted=await wait('adjusted stationary rail',s=>s.rod&&s.home);
  const fitTravel=Math.hypot(...shifted.world.map((v,i)=>v-parked.world[i]));assert(fitTravel>.002&&fitTravel<.015,'The existing fit control did not move the rendered nozzle');
  await slideFit('−');const restored=await wait('restored stationary rail',s=>s.rod&&s.home);
  assert(Math.hypot(...restored.world.map((v,i)=>v-parked.world[i]))<.0001);
  await press('模型');await press('将外阴附件装到裸肤上');
  await wait('mounted is independent of exposed outlet',s=>s.mounted&&!s.confirmed&&!s.shell);
  let beforeMorph,openMorph,morphTravel;
  if(exposed&&process.env.POSE_TAKE_MORPH){
    await require('./game-floor-pose-take.cjs').selectMorph({page,ids,press},process.env.POSE_TAKE_MORPH);
    await page.evaluate(observeOpeningVertex,ids.model);beforeMorph=await page.evaluate(()=>openingVertex());
  }
  await press('操作');
  if(exposed){await press('确认入口露出');await wait('explicitly cleared skin',s=>s.confirmed&&!s.blocked&&s.shell);}
  else{await wait('measured garment obstruction',s=>s.blocked==='garment'&&!s.shell);await absent(['确认入口露出']);await press('保持穿衣继续');}
  await wait('real rail after clothing choice',s=>s.home&&!s.inside&&!s.running);
  await press('阴道');await wait('live illustration',s=>!!s.art);
  await save('workbench','observation:vagina',true);
  await press('推进');const deep=await wait('physical nozzle inside',s=>s.inside&&s.depth>.025&&Math.abs(s.depth-s.measured)<.0001);
  if(beforeMorph){
    openMorph=await page.evaluate(()=>openingVertex());const gain=openMorph.weight-beforeMorph.weight;
    morphTravel=Math.hypot(...openMorph.p.map((v,i)=>v-beforeMorph.p[i]));
    assert(gain>.01&&morphTravel>1e-4,'Chosen opening shape did not reach the drawn GPU surface');
    assert(openMorph.p.every((v,i)=>Math.abs(v-beforeMorph.p[i]-gain*openMorph.delta[i])<1e-4),'Drawn deformation does not match the selected PMX channel');
  }
  await wait('rendered cutaway shows verified crossing',s=>s.art?.includes('在内'));
  await save('inside','observation:vagina',true);await press('释放到宫腔');
  await wait('inside measured uterine dose',s=>s.fluid.fantasyUterine===1&&s.fluid.vaginal===0);
  await press('停止');await wait('stop inside is not crossing evidence',s=>!s.running&&!s.inside&&s.localZ<0);
  if(beforeMorph){const restored=await page.evaluate(()=>openingVertex());assert.deepEqual(restored.p,beforeMorph.p,'Paused sparse output did not restore at stop');}
  await press('释放到宫腔');await frames(3);assert.equal((await read()).fluid.fantasyUterine,1);
  await press('退回起点');const home=await wait('withdraw and rearm',s=>s.home&&s.localZ>.03&&!s.inside);
  assert(Math.hypot(...home.world.map((v,i)=>v-parked.world[i]))<.0001);
  await press('体外释放');await frames(6);if(!exposed)assert((await read()).detail);
  await press('停止');await press('自动支架');await wait('automatic stand parked',s=>s.active==='standAuto'&&!s.running&&s.rod&&s.localZ>.03&&!s.inside);
  await press('开始往复');await press('释放到阴道');await wait('motor delivered on the physical inward pass',s=>s.running&&!s.order&&s.fluid.vaginal===1);
  await page.evaluate(()=>{labFixture.tracking=false;});await frames(4);assert(!(await read()).running);
  await page.evaluate(()=>{labFixture.tracking=true;});await wait('tracking recovery at real outside pose',s=>!s.running&&s.rod&&s.localZ>.03&&!s.inside&&!s.order);
  await press('开始往复');await press('返回角色');await wait('back removes the tool and its evidence',s=>!s.labels&&!s.owned&&!s.active&&!s.rod&&!s.order);
  await click('actorInsert');await press('自动支架');await wait('reselected stand is at home',s=>s.owned&&s.rod&&s.localZ>.03&&!s.running);
  await press('开始往复');await bButton();
  await wait('B interrupts selected operator',s=>!s.owned&&!s.active&&!s.labels&&!s.order);
  await click('hudScenery');await click('hudClassroom');await until('new room has no inherited stand',s=>s.room==='classroom'&&s.ready&&!s.live&&!gameTargets.find({name:'pelvic:stand-piece'}));
  const final=await read(),receipts=await page.evaluate(()=>standTake.receipts),stats=await page.evaluate(()=>standTake.stats());
  assert.equal(stats.coveredShellFrames,0);assert(exposed?stats.maxDrops>0:stats.maxDrops===0,'Wrong exterior routing: '+JSON.stringify(stats));
  assert.equal(receipts.length,2);assert(receipts.every(r=>r.running&&r.localZ<0&&r.measured>0));
  assert.deepEqual(final.fluid,{vaginal:1,fantasyUterine:1});await page.evaluate(()=>standTake.dispose());
  if(!await page.evaluate(()=>gameTargets.find({key:'settingsVrDesktopExit'})))await bButton();
  await click('settingsVrDesktopExit',{retiring:true});await until('stand session retired',s=>s.phase==='ended'&&!s.live&&!s.overlay);
  const adapters=await page.evaluate(()=>labFixture.adapters);assert(adapters.some(a=>a.xrCompatible)&&adapters.every(a=>a.vendor&&!a.fallback&&!/swiftshader|warp|software/i.test(JSON.stringify(a))));
  return {exposed,parkedZ:parked.localZ,fitTravel,depth:deep.measured,morphTravel,deliveredDepths:receipts.map(r=>r.measured),captures,...stats};
};
