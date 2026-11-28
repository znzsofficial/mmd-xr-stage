const assert = require('node:assert/strict');

// Both helpers operate on the already mounted product room. No second PMX or
// evaluator: the only inputs are the XR pointer, buttons and tracked frames.
async function observePoseTake(assetId) {
  const {useBackpack} = await import('/src/mmdVrShowcase/backpack/store.ts');
  const {usePelvic} = await import('/src/mmdVrShowcase/pelvic/store.ts');
  const {usePoseSession} = await import('/src/mmdVrShowcase/pose/poseSession.ts');
  const {centerZ,tipHeight} = await import('/src/mmdVrShowcase/play/siliconeProfile.ts');
  const {scene} = gameTargets.floorState();
  const runtimeId=useBackpack.getState().live[assetId].runtimeId;
  let mesh;
  scene.traverse(o=>{if(o.userData.mmdModelId===runtimeId)o.traverse(m=>{if(m.isSkinnedMesh&&m.userData.mmdMorphs)mesh??=m;});});
  if(!mesh)throw Error('Rendered PMX not found');
  const images={}, trace=[];
  const point=mesh.position.clone();
  function read(){
    const {byAsset,active,sample,parkedSample,support}=usePelvic.getState(),profile=byAsset[assetId];
    const rod=scene.getObjectByName('play:piece:dildo'),port=scene.getObjectByName(`pelvic:adapter:${assetId}`);
    const z=rod&&port?port.worldToLocal(rod.localToWorld(point.set(0,tipHeight,centerZ(tipHeight)))).z:null;
    const chosen=profile?.apertureMorph,weight=chosen==null?null:mesh.morphTargetInfluences[mesh.morphTargetDictionary[chosen]];
    return {token:active?.token,mode:active?.mode,running:!!active?.running,take:active?.take?.kind,home:!!(sample??parkedSample)?.railHome,
      inside:!!sample?.outletInside,z,clothed:!!profile?.clothed,blocked:support[assetId]?.obstruction,chosen,weight,
      fluid:profile?.fluid.vaginal??0,seconds:profile?.technique?.seconds,editing:usePoseSession.getState().editing,
      bound:!!mesh.parent&&useBackpack.getState().live[assetId]?.runtimeId===runtimeId};
  }
  function capture(key){
    if(labFixture.take)throw Error('Overlapping XR captures');
    return new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{labFixture.take=null;reject(Error('No submitted pose frames'));},10000);
      labFixture.take={eyeY:1.45,eyeZ:0,inputs(){this.time=performance.now();},afterDraw(session){
        clearTimeout(timeout);labFixture.take=null;
        session.copyEyes().then(pair=>{images[key]=pair;resolve();},reject);
      }};
    });
  }
  function difference(a,b){return images[a].map((im,eye)=>{
    const other=images[b][eye];let changed=0;
    for(let y=Math.round(im.height*.16);y<im.height*.9;y++)for(let x=Math.round(im.width*.27);x<im.width*.74;x++){
      const k=4*(y*im.width+x);if([0,1,2].some(c=>Math.abs(im.data[k+c]-other.data[k+c])>6))changed++;
    }return changed;
  });}
  function startTrace(){
    if(labFixture.take)throw Error('Overlapping XR takes');
    labFixture.take={time:performance.now(),inputs(){this.time+=1000/72;},afterDraw(){
      const {token,take,z,inside,fluid,weight,home}=read();trace.push({token,take,z,inside,fluid,weight,home});
    }};
  }
  window.poseTake={read,capture,difference,startTrace,stopTrace(){labFixture.take=null;return trace;}};
}

// A supplied name is a local test parameter. Do not require a particular
// author, language or model in the product or print private channel names.
async function selectMorph({page,ids,press},requested){
  const {name,pageIndex}=await page.evaluate(async({id,requested})=>{
    const {useBackpack}=await import('/src/mmdVrShowcase/backpack/store.ts');
    const {usePelvic}=await import('/src/mmdVrShowcase/pelvic/store.ts');
    const list=useBackpack.getState().live[id].propMorphs??[], current=usePelvic.getState().byAsset[id].apertureMorph;
    const face=usePelvic.getState().support[id]?.responseMorphs??[];
    const i=requested?list.indexOf(requested):list.findIndex(name=>!face.includes(name));
    if(i<0||!list[i])throw Error('No matching drawable opening morph in selected PMX');
    return {name:list[i],pageIndex:Math.floor(i/3)-Math.max(0,Math.floor(list.indexOf(current)/3))};
  },{id:ids.model,requested});
  await press('选择开合形态');
  for(let i=0;i<Math.abs(pageIndex);i++)await press(pageIndex>0?'下一页':'上一页');
  await press(name);
  assert(await page.evaluate(async([id,name])=>{
    const {usePelvic}=await import('/src/mmdVrShowcase/pelvic/store.ts');return usePelvic.getState().byAsset[id]?.apertureMorph===name;
  },[ids.model,name]),'XR picker did not set the selected actor’s channel');
  await press('返回模型设置');
}

async function gameFloorPoseTake({page,ids,click,until,bButton,frames,target,pickMounted,aim,trigger,idleRay}){
  const actor=await until('selected single PMX',s=>s.selected&&s.ready&&s.modelCount===1&&s.actor?.evaluations>0,null,120000);
  if(actor.physics){await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
    await until('freeze garment and hair for the pose controls',s=>s.ready&&!s.physics&&s.actor.mode==='none');await click('hudBack');
    await target({name:'watch:quiet'});await pickMounted(ids.model);}
  const press=async text=>{await aim(await target({name:'hud:'+text}));await trigger(true);await trigger(false);};
  const quiet=async()=>{await target({name:'watch:quiet'});await idleRay();await frames(3);};
  const capture=async key=>{await quiet();await page.evaluate(key=>poseTake.capture(key),key);};
  const wait=async(label,pred)=>{try{await (await page.waitForFunction(`(${pred})(poseTake.read())`,null,{timeout:30000})).dispose();}
    catch(e){const {chosen,...status}=await page.evaluate(()=>poseTake.read());throw Error(`${label}: ${JSON.stringify(status)}`,{cause:e});}
    return page.evaluate(()=>poseTake.read());};
  await page.evaluate(observePoseTake,ids.model);
  await click('hudChangeMotion');await click('hudApplyBody');
  await until('source dance advancing',s=>s.ready&&s.hasBinding&&s.playing&&s.time>.12);
  await bButton();await click('settingsMmdVrPause');
  const paused=await until('source frame held',s=>s.ready&&!s.playing&&s.hasBinding&&s.actor.poseSeconds===s.time);
  await capture('source');await pickMounted(ids.model);await click('actorPose');await wait('shared pose solver opened',s=>s.editing);
  await press('Z 轴');await press('Z +5°');await press('Z +5°');await press('保留姿势并返回');
  await wait('held manual pose',s=>!s.editing&&s.bound);await click('hudDone');await capture('edited');
  await pickMounted(ids.model);await click('actorPose');await press('恢复原动作');await click('hudDone');await capture('restored');
  const eyes=await page.evaluate(()=>({changed:poseTake.difference('source','edited'),residual:poseTake.difference('source','restored')}));
  assert(eyes.changed.every(n=>n>80)&&eyes.residual.every((n,i)=>n<eyes.changed[i]*.02),`Held pose or source restoration missing in submitted eyes: ${JSON.stringify(eyes)}`);
  await until('same actor and source frame',(s,p)=>s.runtimeId===p.runtimeId&&s.time===p.time&&s.hasBinding&&!s.playing,paused);
  await bButton();await click('settingsMmdVrPlay');await until('source motion resumes',(s,t)=>s.playing&&s.time>t+.08,paused.time);
  await pickMounted(ids.model);await click('actorPose');
  const frozen=await until('entering pose from live dance freezes its clock',s=>s.ready&&!s.playing&&poseTake.read().editing);
  await press('恢复原动作');await until('leaving a formerly playing pose resumes it',(s,p)=>s.runtimeId===p.runtimeId&&s.playing&&s.time>p.time+.05,frozen);
  await bButton();await click('settingsMmdVrPause');await quiet();await pickMounted(ids.model);

  await click('actorInsert');await press('手动支架');await wait('real manual piece at home',s=>s.mode==='standManual'&&s.home&&!s.inside&&s.z>.03);
  await press('调整入口');await press('模型');await selectMorph({page,ids,press},process.env.POSE_TAKE_MORPH);await press('操作');
  if(!(await page.evaluate(()=>poseTake.read().clothed)))await press('保持穿衣继续');
  const parked=await wait('clothed negative and mounted rail',s=>s.home&&s.clothed&&s.chosen!=null);
  await press('调整服装');await click('backToInsert');await wait('wardrobe returns to the mounted piece',s=>s.mode==='standManual'&&s.home);
  assert.equal((await page.evaluate(()=>poseTake.read())).token,parked.token);
  await press('手法录放');await page.evaluate(()=>poseTake.startTrace());
  try{
    await press('录制手法');await wait('record from outside',s=>s.take==='record'&&s.home);await frames(24);
    await press('推进');await press('推进');await wait('recorded inward stroke',s=>s.take==='record'&&s.inside&&s.z<-.012);
    await frames(160);await press('保存手法');
    const saved=await wait('buried endpoint freezes without admission',s=>!s.take&&!s.running&&!s.inside&&s.z<-.012&&s.seconds>1);
    await press('播放手法');await frames(4);assert(!(await page.evaluate(()=>poseTake.read().running)),'Replay admitted a buried starting point');
    await press('退出到起点');await wait('measured home after withdrawal',s=>s.home&&!s.inside&&s.z>.03);
    await press('播放手法');await press('返回操作');const replay=await wait('fresh replay reaches inside',s=>s.take==='replay'&&s.inside&&s.z<-.012);
    assert.equal(replay.fluid,parked.fluid,'Recorded strokes cannot replay a release');
    await press('释放到阴道');await (await page.waitForFunction(prev=>poseTake.read().fluid===prev+1,parked.fluid)).dispose();
    const stopped=await wait('saved technique completes',s=>!s.take&&!s.running);await press('返回角色');
    const trace=await page.evaluate(()=>poseTake.stopTrace());
    const replayFrames=trace.filter(f=>f.token===replay.token&&f.take==='replay');
    const outside=replayFrames.findIndex(f=>f.z>.03&&!f.inside),inside=replayFrames.findIndex(f=>f.inside&&f.z<0);
    assert(outside>=0&&inside>outside,'Replay lacked an independently measured outside → inside crossing');
    const delivery=replayFrames.findIndex(f=>f.fluid>parked.fluid);
    assert(delivery>=inside&&replayFrames[delivery].z<0&&replayFrames[delivery].inside,'Dose was not received on a measured inside frame');
    const dwell=replayFrames.filter(f=>Math.abs(f.z-saved.z)<.0001&&f.inside);
    assert(dwell.length>40,'Saved dwell was absent at the replay endpoint');
    assert(trace.every(f=>Math.abs(f.weight-parked.weight)<1e-6),'Clothed contact changed the selected exterior morph');
    await target({key:'actorPose'});await click('actorInsert');
    const resumed=await page.evaluate(()=>poseTake.read());assert.equal(resumed.token,stopped.token);assert(!resumed.running&&Math.abs(resumed.z-stopped.z)<.0001);
    await press('收起假阳具');await press('返回角色');
    const final=await until('tool stowed, same paused actor selected',(s,id)=>s.selected&&s.runtimeId===id&&s.hasBinding&&!s.playing&&!poseTake.read().mode,actor.runtimeId);
    assert.equal((await page.evaluate(()=>poseTake.read())).fluid,parked.fluid+1);
    return {eyes,pausedAt:paused.time,restoredAt:paused.time,resumedTo:final.time,takeSeconds:saved.seconds,replayedDwellFrames:dwell.length,
      outsideZ:replayFrames[outside].z,firstInsideZ:replayFrames[inside].z,deliveredZ:replayFrames[delivery].z};
  }finally{await page.evaluate(()=>{if(window.poseTake){poseTake.stopTrace();delete window.poseTake;}});}
}

module.exports=gameFloorPoseTake;
module.exports.selectMorph=selectMorph;
