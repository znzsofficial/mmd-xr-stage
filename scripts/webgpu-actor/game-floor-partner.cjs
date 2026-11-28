const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const captureEyes = require('./game-floor-partner-eyes.cjs');

async function observePartner(asset) {
  const {useBackpack} = await import('/src/mmdVrShowcase/backpack/store.ts');
  const {usePoseSession} = await import('/src/mmdVrShowcase/pose/poseSession.ts');
  const {useStagePlay} = await import('/src/mmdVrShowcase/play/stagePlay.ts');
  const {usePelvic} = await import('/src/mmdVrShowcase/pelvic/store.ts');
  const {projectDepth} = await import('/src/mmdVrShowcase/pelvic/path.ts');
  const {centerZ,tipHeight} = await import('/src/mmdVrShowcase/play/siliconeProfile.ts');
  const {scene} = gameTargets.floorState(), runtime = useBackpack.getState().live[asset].runtimeId;
  let mesh;
  scene.traverse(o => { if (o.isSkinnedMesh && o.userData.mmdModelId===runtime && o.userData.mmdMorphs) mesh??=o; });
  if (!mesh) throw Error('No displayed PMX skeleton');

  // Compare the displayed major joints in metres, independently of the pose
  // editor's isolated solver. Hair, clothing and face reactions are not joints.
  const major = /^(頭|上半身|下半身|[左右](?:手首|ひざ|膝|足首)|head|hips?|pelvis|upperbody|lowerbody|spine|chest|(?:left|right)(?:wrist|hand|knee|shin|ankle|foot))$/;
  const joints = mesh.skeleton.bones.filter(b => [b.name,b.userData.mmdBoneName,b.userData.mmdEnglishBoneName].some(n =>
    typeof n==='string' && major.test(n.normalize('NFKC').toLowerCase().split(':').pop().replace(/[\s_.-]/g,''))));
  if (joints.length<4) throw Error('Too few displayed major joints to compare the held pose');
  const pose = () => joints.map(b => b.getWorldPosition(mesh.position.clone()).toArray());
  const neutral = pose(); let held;
  function drift(base) {
    return Math.max(...joints.map((b,i) => b.getWorldPosition(mesh.position.clone()).distanceTo(mesh.position.clone().fromArray(base[i]))));
  }
  function shown(o) {
    if (!o) return false;
    for (let p=o;p;p=p.parent) if (!p.visible) return false;
    return !o.isMesh || [o.material].flat().some(m=>m.visible && m.colorWrite && m.opacity>0);
  }
  const peak = {inside:0,outside:null,passes:0,drops:0}; let phase='in',foldBalance=null;
  // Capture on the actual fold, before the first frame without controls. A
  // legitimate delivery while the controller is still aiming precedes it.
  const offSelection=useBackpack.subscribe((b,prev)=>{
    const {active,byAsset}=usePelvic.getState();
    if(prev.selected===asset&&!b.selected&&active?.runtimeId===runtime&&active.assetId===asset&&active.mode==='standAuto')
      foldBalance={...byAsset[asset].fluid};
  });
  function read() {
    const s=usePelvic.getState(), active=s.active, profile=s.byAsset[asset], sample=s.sample??s.parkedSample;
    const rig=scene.getObjectByName('pelvic:rig'), get=name=>rig?.getObjectByName('pelvic:'+name);
    const partner=get('partner'), torso=partner?.getObjectByName('pelvic:partner-torso'), head=partner?.getObjectByName('pelvic:partner-head');
    const stand=get('stand-piece'), rod=root=>root?.getObjectByName('play:piece:dildo');
    const partnerRod=rod(get('partner-piece')), standRod=rod(stand), rails=shown(get('rails'));
    const displayPartner=shown(partner)&&shown(head)&&shown(torso)&&shown(partnerRod);
    const selected=profile?.standAppearance==='partner'?partnerRod:standRod, port=get('adapter:'+asset);
    const world=shown(selected)?selected.localToWorld(mesh.position.clone().set(0,tipHeight,centerZ(tipHeight))):null;
    const local=world && port?.worldToLocal(world.clone());
    const p=usePoseSession.getState();
    return {profile:!!profile,appearance:profile?.standAppearance,mode:active?.mode??null,token:active?.token,partnerId:partner?.uuid,
      owned:active?.assetId===asset && active.runtimeId===runtime && useStagePlay.getState().stand?.assetId===asset,
      standOwned:!!useStagePlay.getState().stand,running:!!active?.running,home:!!sample?.railHome,inside:!!s.sample?.outletInside,
      depth:sample?.depth,measured:local&&sample?projectDepth(sample,local):null,z:local?.z,world:world?.toArray(),
      tipError:local&&sample?local.distanceTo(mesh.position.clone().fromArray(sample.tip)):null,
      partnerOnly:displayPartner&&!shown(stand)&&!shown(standRod)&&!rails,standOnly:rails&&shown(standRod)&&!shown(partner)&&!shown(partnerRod),
      anyTool:rails||shown(stand)||shown(standRod)||shown(partner)||shown(partnerRod),
      body:displayPartner?[torso,head].map(o=>o.getWorldPosition(mesh.position.clone()).toArray()):null,
      clothed:!!profile?.clothed,confirmed:!!profile?.clothingClear,obstruction:s.support[asset]?.obstruction,
      editing:p.runtimeId===runtime&&p.assetId===asset&&p.editing,
      held:p.runtimeId===runtime&&p.assetId===asset&&!p.editing&&p.canUndo,poseDrift:held?drift(held):null,
      receipt:s.strokeReceipt,fluid:profile?.fluid,foldBalance,sheet:!!scene.getObjectByName('pelvic:controls'),observer:!!scene.getObjectByName('pelvic:observer'),
      samples:!!(s.sample||s.parkedSample),auto:{...peak}};
  }
  // The simulated display supplies regular 72 Hz timestamps even for a slow
  // local PMX. Input events and updates still go through the production loop.
  let clock;
  function startClock() {
    if (labFixture.take) throw Error('Overlapping partner takes');
    labFixture.take=clock={time:performance.now(),inputs(){this.time+=1000/72;},afterDraw(){
      window.partnerTake.onDraw?.();
      if (usePelvic.getState().active?.mode!=='standAuto' || !usePelvic.getState().active.running) return;
      const r=read(); if (!r.partnerOnly) return;
      peak.drops=Math.max(peak.drops,scene.getObjectByName('play:liquid-spray')?.count??0);
      if (r.inside && r.measured>.015 && r.depth>.005) {
        peak.inside=Math.max(peak.inside,r.measured);
        if (phase==='in') { peak.passes++; phase='out'; }
      } else if (phase==='out' && !r.inside && r.z>.02) { peak.outside=r.z; phase='in'; }
    }};
  }
  window.partnerTake={read,pose,get clock(){return clock;},keepPose(){held=pose();return drift(neutral);},startClock,
    dispose(){offSelection();if (labFixture.take===clock) labFixture.take=null;delete window.partnerTake;}};
}

// Catalog identity selects the group and label; only controller presses can
// change the page or apply the preset. Never address a choice by its row.
async function choosePose({page,press,target},id) {
  const {group,wanted}=await page.evaluate(async id=>{
    const {presetGroups}=await import('/src/mmdVrShowcase/pose/presetCatalog.ts');
    for(const [group,choices] of Object.entries(presetGroups)) {
      const match=choices.find(p=>p.id===id); if(match)return {group,wanted:match.zh};
    }
    throw Error('Missing catalog pose '+id);
  },id);
  const basicPageTwo=id==='sideForwardLeg'||id==='halfKneel';
  if(basicPageTwo)assert.equal(group,'basic',`${id}: expected basic poses page two`);
  if(id==='supineKneeHug')assert.equal(group,'teasing');
  await press('快速体位');
  await press({basic:'基础体位',teasing:'挑逗体位'}[group]);
  const visible=()=>page.evaluate(n=>!!gameTargets.find({name:'hud:'+n}),wanted);
  if(basicPageTwo||!await visible()) {
    if(basicPageTwo)assert(!await visible(),`${id}: unexpectedly on the first basic page`);
    await target({name:'hud-label:1/2'}); await press('下一页'); await target({name:'hud-label:2/2'});
  } else if(id==='allFours') {
    await press('下一页'); await target({name:'hud-label:2/2'}); assert(!await visible());
    await press('上一页'); await target({name:'hud-label:1/2'});
  }
  await press(wanted); await target({name:'hud-label:已应用 · '+wanted});
}

module.exports = async function({page,ids,click,until,bButton,frames,target,pickMounted,aim,trigger,idleRay,exposed,partnerPoses}) {
  const actor=await until('local adult PMX placed',s=>s.ready&&s.selected&&s.visible&&s.actor?.evaluations>0,null,120000);
  if (actor.physics) {
    await bButton(); await click('hudMore'); await click('settingsCharacter'); await click('settingsMmdVrPhysicsOn');
    await until('held comparison without Bullet',s=>s.ready&&!s.physics&&s.actor.mode==='none');
    await click('hudBack'); await target({name:'watch:quiet'}); await pickMounted(ids.model);
  }
  const press=async text=>{ await aim(await target({name:'hud:'+text})); await trigger(true); await trigger(false); };
  const read=()=>page.evaluate(()=>partnerTake.read());
  async function wait(label,predicate) {
    try { await (await page.waitForFunction(`(${predicate})(partnerTake.read())`,null,{timeout:40000})).dispose(); }
    catch (e) { throw Error(`${label}: ${JSON.stringify(await read())}`,{cause:e}); }
    return read();
  }
  const travel=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
  const poseStable=r=>assert(r.held&&r.poseDrift<.015,`Held actor pose changed: ${r.poseDrift} m`);
  async function moveSheetAside(){
    const drag=await page.evaluate(()=>{
      const panel=gameTargets.floorState().scene.getObjectByName('backpack-world-tools');
      const title=panel.getObjectByName('actor:move-sheet'), sign=Math.sign(panel.position.x)||1;
      return [[0,0],[sign*1.45,1.25]].map(([x,y])=>title.localToWorld(title.position.clone().set(x,y,0)).toArray());
    });
    await aim(drag[0]); await trigger(true); await aim(drag[1]); await trigger(false); await idleRay();
  }
  await page.evaluate(observePartner,ids.model);
  try {
    await click('actorPose'); await choosePose({page,press,target},'matingPress'); await press('保留姿势并返回'); await target({key:'actorInsert'}); await frames(3);
    const poseChange=await page.evaluate(()=>partnerTake.keepPose());
    assert(poseChange>.08 && (await read()).held,'Preset did not change and hold the displayed PMX');
    await click('actorInsert'); assert(!(await read()).profile,'Expected first use on a fresh actor');
    await press('半透明搭档');
    const parked=await wait('first use mounts only the parked partner',r=>r.partnerOnly&&r.appearance==='partner'&&r.owned&&r.mode==='standManual'&&r.home&&!r.running&&!r.inside&&r.z>.03&&r.tipError<.001);
    poseStable(parked); await target({name:'hud:手动控制'}); await target({name:'hud:自动往复'});
    // The operator sheet ignores depth. Move it aside by the real title so
    // that neither its buttons nor its live panel can mask the paired shot.
    await moveSheetAside();
    const {png,...eyes}=await page.evaluate(captureEyes);
    const dir=path.join(__dirname,'../../local-review/screenshots/partner-workbench'); await fs.mkdir(dir,{recursive:true});
    const capture=(exposed?'exposed':'covered')+'-partner-stereo.png'; await fs.writeFile(path.join(dir,capture),Buffer.from(png,'base64'));
    assert(eyes.skipped.every(n=>n>0) && [eyes.torso,eyes.head].every(pair=>pair.length===2&&pair.every(e=>e.pixels>24)),`Missing partner in submitted eyes: ${JSON.stringify(eyes)}`);
    assert(eyes.alpha.every(values=>values.length && values.every(a=>a>0&&a<1)),'Expected translucent head and torso');
    assert([eyes.torso,eyes.head].some(([l,r])=>l.centerX-r.centerX>1),'Partner eye images lack stereo parallax');

    await page.evaluate(()=>partnerTake.startClock());
    await press(exposed?'确认入口露出':'保持穿衣继续');
    const ready=await wait('chosen clothing path at measured home',r=>r.owned&&r.partnerOnly&&r.home&&r.z>.03&&!r.inside);
    assert(exposed?ready.confirmed&&!ready.clothed&&!ready.obstruction:ready.clothed&&!ready.confirmed,'Wrong clothing choice');
    await press('推进'); await frames(40);
    const inside=r=>r.owned&&r.running&&r.inside&&r.z<-.015&&r.measured>.015&&r.tipError<.001&&Math.abs(r.measured-r.depth)<.001;
    const deep=await wait('partner outlet crosses and settles at measured depth',inside); assert(deep.partnerOnly); poseStable(deep);
    const tipTravel=travel(ready.world,deep.world); assert(tipTravel>.045,'Partner outlet did not travel from outside');

    await press('支架');
    const stand=await wait('only original stand draws at the held depth',r=>r.appearance==='stand'&&r.standOnly);
    await press('半透明搭档');
    const back=await wait('partner replaces stand at the held depth',r=>r.appearance==='partner'&&r.partnerOnly);
    for (const r of [stand,back]) {
      assert.equal(r.token,deep.token,'Appearance switch replaced the operator'); poseStable(r);
      assert(inside(r)&&travel(deep.world,r.world)<.002,'Appearance switch moved the outlet or lost admission');
    }
    const partnerDrift=Math.max(...back.body.map((p,i)=>travel(p,deep.body[i])));
    assert(partnerDrift<.015,'Partner head or torso jumped on return');
    // Return to actor tools, then dismiss those tools with Done. Neither
    // controller release is a motor command or a request to stow the mesh.
    await press('返回角色'); await click('hudDone'); await target({name:'watch:quiet'}); await frames(8);
    const hidden=await read();
    assert(!hidden.sheet&&!hidden.observer&&hidden.partnerOnly&&inside(hidden)); poseStable(hidden);
    assert.equal(hidden.partnerId,back.partnerId); assert.equal(hidden.token,back.token); assert(travel(hidden.world,back.world)<.002);
    const {png:foldedPng,...foldedEyes}=await page.evaluate(captureEyes);
    const foldedCapture=(exposed?'exposed':'covered')+'-partner-folded-stereo.png';
    await fs.writeFile(path.join(dir,foldedCapture),Buffer.from(foldedPng,'base64'));
    assert([foldedEyes.torso,foldedEyes.head].every(pair=>pair.every(e=>e.pixels>24)),'Missing partner in folded stage eye images');
    await pickMounted(ids.model); await click('actorInsert'); await press('停止');
    const frozen=await wait('stop freezes the same manual partner at depth',r=>r.owned&&r.partnerOnly&&!r.running&&!r.inside&&r.z<-.015);
    assert.equal(frozen.partnerId,back.partnerId); assert(travel(frozen.world,back.world)<.002);
    await click('bodyPeek'); await target({name:'watch:quiet'}); await frames(8); await pickMounted(ids.model); await click('actorInsert');
    const reopened=await read(); assert(reopened.sheet&&!reopened.running&&reopened.token===frozen.token&&reopened.partnerId===frozen.partnerId);
    assert(travel(reopened.world,frozen.world)<.002); poseStable(reopened);
    await press('退回起点'); const home=await wait('manual outlet returns to home',r=>r.partnerOnly&&r.home&&!r.inside&&r.z>.03);
    assert(travel(home.world,ready.world)<.002); await press('停止');
    await press('自动往复'); await wait('automatic partner parked',r=>r.mode==='standAuto'&&!r.running&&r.partnerOnly&&r.z>.03&&!r.inside);
    await press('开始往复'); await wait('two admitted motor passes with an outside frame between',r=>r.auto.passes>=2);
    await aim(await target({name:'hud:体外释放'}));const beforeOutside=await wait('request on an internal stroke',r=>r.inside&&r.depth>.035);
    await trigger(true);await trigger(false);
    if(exposed)await wait('named outside delivery and visible particles',r=>r.receipt==='deliveredOutside'&&r.auto.drops>0);
    else {await frames(155);assert.equal((await read()).auto.drops,0);}
    assert.deepEqual((await read()).fluid,beforeOutside.fluid,'Outside release credited an internal site');
    await click('bodyPeek'); await target({name:'watch:quiet'});
    const folded=await read(); assert(folded.owned&&folded.running&&folded.partnerOnly&&!folded.sheet&&!folded.observer);
    assert.deepEqual(folded.fluid,folded.foldBalance);
    await (await page.waitForFunction(n=>partnerTake.read().auto.passes>=n+2,folded.auto.passes,{timeout:40000})).dispose();
    await pickMounted(ids.model); await click('actorInsert');
    const cycling=await read(); assert(cycling.sheet&&cycling.running&&cycling.partnerOnly);assert.deepEqual(cycling.fluid,folded.foldBalance);
    assert.equal(cycling.token,folded.token); assert.equal(cycling.partnerId,folded.partnerId); poseStable(cycling);
    await press('停止往复'); await wait('automatic partner stopped',r=>r.mode==='standAuto'&&!r.running&&r.partnerOnly);
    await press('手动控制'); await wait('manual partner restored outside',r=>r.owned&&r.mode==='standManual'&&!r.running&&r.partnerOnly&&r.home&&!r.inside);
    if(partnerPoses)await moveSheetAside(); // Re-picking the actor recalled a new sheet at its usual position.
    const poses=partnerPoses?await require('./game-floor-partner-poses.cjs')({page,asset:ids.model,runtime:actor.runtimeId,exposed,dir,
      press,target,frames,idleRay,wait,poseStable,inside,choosePose:id=>choosePose({page,press,target},id)}):undefined;
    const gone=r=>!r.mode&&!r.standOwned&&!r.anyTool&&!r.samples;
    await press('收起搭档'); const dismissed=await wait('dismiss removes both representations',gone); poseStable(dismissed); assert(dismissed.sheet);
    await press('返回角色'); await until('same held PMX after dismissal',(s,id)=>s.runtimeId===id&&s.ready&&s.selected&&!s.playing,actor.runtimeId);
    await bButton(); await click('settingsVrDesktopExit',{retiring:true}); await until('partner session retired',s=>s.phase==='ended'&&!s.overlay&&!s.live);
    const adapters=await page.evaluate(()=>labFixture.adapters);
    assert(adapters.some(a=>a.xrCompatible)&&adapters.every(a=>a.vendor&&!a.fallback&&!/swiftshader|warp|software|llvmpipe/i.test(JSON.stringify(a))),'Missing hardware GPU');
    return {clothing:exposed?'exposed':'covered',poseChangeM:poseChange,tipTravelM:tipTravel,depthM:deep.measured,switchToken:deep.token,
      maxSwitchPoseDriftM:Math.max(stand.poseDrift,back.poseDrift),partnerDriftM:partnerDrift,foldedManualDriftM:travel(hidden.world,back.world),
      auto:cycling.auto,eyes,capture,foldedEyes,foldedCapture,poses};
  } finally { await page.evaluate(()=>window.partnerTake?.dispose()); }
};
