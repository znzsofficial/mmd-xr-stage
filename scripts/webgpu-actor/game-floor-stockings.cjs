// game-floor-smoke.cjs <private bare-leg humanoid.pmx> <body.vmd> --single-actor stockings
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const output = path.resolve(__dirname,'../../local-review/screenshots/stockings');
async function writeCrops(backend, tag, pngs) {
  const dir = path.join(output,backend);
  await fs.mkdir(dir,{recursive:true});
  await Promise.all(pngs.map((png,i)=>fs.writeFile(path.join(dir,tag+(pngs.length===2?['-left','-right'][i]:'')+'.png'),Buffer.from(png,'base64'))));
}

// Identical semantics on both entry points. The caller supplies the real
// buttons and device transitions; readStockingState is an observer only.
async function play({page,press,back,open,move,hold,capture,settle,whileTorn,xrInterruptions}) {
  const state = () => page.evaluate(()=>stockingProbe.status());
  const wait = async (label, predicate) => {
    try { await (await page.waitForFunction(`(${predicate})(stockingProbe.status())`,null,{timeout:12000})).dispose(); }
    catch (e) { throw Error(`${label}: ${JSON.stringify(await state())}`,{cause:e}); }
  };
  await open();
  const original = await state();
  assert(original.live && original.selected && !original.worn && !original.tears.length,'Start with a freshly imported positive actor');
  await capture('source-off');
  await press('穿上'); await wait('Positive PMX did not supply a pair of fitted leg surfaces',s=>s.worn && s.fit==='ready');
  await capture('source-intact');
  await press('撕扯模式'); await wait('The selected garment was not armed',s=>s.armed);
  const {route,fraction}=await page.evaluate(()=>stockingProbe.plan('left'));
  await move(route[0]); await hold(true); await hold(false); await settle();
  assert.equal((await state()).tears.length,0,'A tap is not a tear');
  const interruptions = await xrInterruptions?.losses(route);
  await move(route[0]); await hold(true);
  try { for (const p of route.slice(1)) await move(p);
    if (xrInterruptions) interruptions.visibleGap = await xrInterruptions.visibleGap();
    assert.equal((await state()).tears.length,0,'Tear committed before release');
  } finally { await hold(false); }
  await wait('No one-sided tear after held physical pull and release',s=>s.tears.length===1 && s.tears[0].side==='left');
  const {tears}=await state();
  await move(route[0]); await settle(); assert.deepEqual((await state()).tears,tears,'Pointer travel after release changed the pair');
  await capture('source-torn');
  async function difference(a,b,c) { return page.evaluate(([a,b,c,f])=>stockingProbe.compare(a,b,c,f),[a,b,c,fraction]); }
  function requireTear(eyes,pose) {
    for(const [left,right] of eyes){
      const detail=`${pose}: ${JSON.stringify({left,right})}`;
      assert(left.garment>=100 && right.garment>=100,'Missing rendered bilateral knit: '+detail);
      assert(left.revealed>=8 && left.nearStroke>=left.revealed*.65 && left.changed<left.garment*.45,'Missing localized opening onto original leg: '+detail);
      assert(right.changed<=Math.max(2,left.revealed*.025),'Other stocking changed: '+detail);
    }
  }
  const source = await difference('source-off','source-intact','source-torn'); requireTear(source,'source');
  await back(); await wait('Leaving garment sheet must disarm',s=>!s.armed);
  if(whileTorn) await whileTorn(tears);
  const before=await page.evaluate(()=>stockingProbe.feet());
  await press('摆姿势'); await press('快速体位'); await press('站姿前倾'); await press('保留姿势并返回'); await settle();
  const after=await page.evaluate(()=>stockingProbe.feet());
  assert(Math.max(...after.map((v,i)=>Math.hypot(...v.map((n,j)=>n-before[i][j]))))>.025,'New pose did not move the displayed legs');
  assert.deepEqual((await state()).tears,tears,'The new pose lost or relocated the recorded tear');
  await open(); await capture('pose-torn');
  await press('换新袜'); await wait('Replace stockings did not reset damage',s=>s.worn && !s.tears.length && !s.armed);
  await capture('pose-intact'); await press('脱下'); await wait('Take off did not restore the original materials',s=>!s.worn && !s.armed && s.original);
  await capture('pose-off');
  const pose = await difference('pose-off','pose-intact','pose-torn'); requireTear(pose,'cross-pose');
  await back(); await press('摆姿势'); await press('恢复原动作'); await settle(); await open(); await capture('source-off-restored');
  // Zero within the same two ankle/knee regions, regardless of moving floor print elsewhere.
  const restored=await difference('source-intact','source-off','source-off-restored');
  assert(restored.every(pair=>pair.every(r=>r.garment>=100 && r.changed<=2)),`OFF did not restore the original drawn leg: ${JSON.stringify(restored)}`);
  await press('穿上'); await wait('Redress the replaced pair',s=>s.worn && s.fit==='ready' && !s.tears.length); await capture('source-new-pair');
  const fresh=await difference('source-off','source-intact','source-new-pair');
  assert(fresh.every(pair=>pair.every(r=>r.garment>=100 && r.changed<=2)),`Replacement did not return to the first intact pair: ${JSON.stringify(fresh)}`);
  await press('脱下'); await wait('Finish with the original actor',s=>!s.worn && s.original);
  await back(); const final=await state(); assert(final.original && final.selected && final.live && !final.worn);
  return {source,pose,restored,fresh,...(interruptions && {interruptions})};
}

// Change only the simulated display. Keep grip and target-ray poses tracked,
// including on the ONE callback where Three and its host see no viewer pose.
function interruptDisplay(kind) {
  const session = labSession, request = session.requestAnimationFrame;
  const {gl,scene} = gameTargets.floorState(), right = session.inputSources.find(s=>s.handedness==='right');
  const surface = scene.getObjectByName('wardrobe:stocking-input');
  const captured = () => [...globalThis.pointerEventspointerMap.keys()].some(id=>surface.hasPointerCapture(id));
  if (!captured() || !right.gamepad.buttons[0].pressed) throw Error('Expected a physical press captured on the fitted leg');
  if (kind==='visible-blurred' || kind==='hidden') {
    session.visibilityState=kind; session.dispatchEvent(new Event('visibilitychange'));
    const capturedAfter = captured();
    session.visibilityState='visible'; session.dispatchEvent(new Event('visibilitychange'));
    return {capturedAfter}; // no intervening Fiber frame
  }
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{session.requestAnimationFrame=request;reject(Error('No XR callback for '+kind));},12000);
    session.requestAnimationFrame = deliver => {
      session.requestAnimationFrame = request;
      const started = performance.now();
      return request(function next(time,frame) {
        // Delay delivery to Three; the display remains visible and its clock
        // stays monotonic through this frame and the one after it.
        if (kind==='visible-frame-gap' && time-started<320) { request(next); return; }
        const pose=frame.getViewerPose, before=labFixture.hostStatus().frames;
        try {
          const ref=gl.xr.getReferenceSpace();
          if (!pose(ref) || !frame.getPose(right.gripSpace,ref) || !frame.getPose(right.targetRaySpace,ref)) throw Error('Control pose unavailable');
          if (kind==='viewer-pose-lost') frame.getViewerPose=()=>null;
          deliver(time,frame);
          resolve({draws:labFixture.hostStatus().frames-before,capturedAfter:captured(),intervalMs:time-started});
        } catch (error) { reject(error); }
        finally { clearTimeout(timer); frame.getViewerPose=pose; }
      });
    };
  });
}

module.exports = async function({page,ids,click,until,bButton,frames,target,pickMounted,aim,trigger,idleRay}) {
  const s=await until('selected actor for stocking take',s=>s.selected && s.ready && s.actor?.evaluations>0);
  const adapters=await page.evaluate(()=>labFixture.adapters);
  assert(adapters.some(a=>a.xrCompatible) && adapters.every(a=>a.vendor && !a.fallback && !/software|swiftshader|warp|llvmpipe/i.test(JSON.stringify(a))),'No verified XR hardware WebGPU adapter');
  if (s.playing) { await bButton(); await click('settingsMmdVrPause'); await pickMounted(ids.model); }
  if (s.physics) {
    await bButton(); await click('hudMore'); await click('settingsCharacter'); await click('settingsMmdVrPhysicsOn');
    await until('hold hair, clothing and post-physics pose',s=>s.ready && !s.physics);
    await click('hudBack'); await target({name:'watch:quiet'}); await pickMounted(ids.model);
  }
  await page.evaluate(async id=>{const {observe}=await import('/scripts/webgpu-actor/stocking-probe.js');window.stockingProbe=observe(id);},ids.model);
  const press=async label=>{await aim(await target({name:'hud:'+label}));await trigger(true);await trigger(false);};
  const open=async()=>{await click('actorWardrobe');await press('可撕丝袜');};
  const back=async()=>{await press('返回衣柜');await press('返回角色');};
  const move=async({from,to})=>{
    await page.evaluate(({from:[x,y,z],to})=>{
      const dx=to[0]-x,dy=to[1]-y,dz=to[2]-z,w=Math.hypot(dx,dy,dz)-dz,len=Math.hypot(dx,dy,w);
      const pose={position:{x,y,z},orientation:{x:dy/len,y:-dx/len,z:0,w:w/len}};
      labSession.setControllerPose('right',pose,pose);
    },{from,to}); await frames(2);
  };
  const capture=async tag=>{await idleRay(); await frames(3);
    const pngs=await page.evaluate(t=>stockingProbe.eyes(t),tag); await writeCrops('webgpu-xr',tag,pngs); await frames(3);
  };
  const interruptedPulls=async route=>{
    const checks={};
    // Finish with the single dropped pose. No tear-mode button or other
    // re-arming step between that stale release and the successful fresh pull.
    for (const reason of ['visible-blurred','hidden','viewer-pose-lost']) {
      await move(route[0]); await trigger(true);
      try {
        checks[reason]=await page.evaluate(interruptDisplay,reason);
        assert.equal(checks[reason].capturedAfter,false,reason+' left the old pointer captured');
        if (reason==='viewer-pose-lost') assert.equal(checks[reason].draws,0,'Room consumed the frame without a viewer pose');
        await move(route.at(-1)); // reacquire with the same trigger STILL held
      } finally { await trigger(false); }
      const after=await page.evaluate(()=>stockingProbe.status());
      assert.equal(after.tears.length,0,reason+' committed a stale pull');
      assert.equal(after.armed,reason==='viewer-pose-lost',reason+' did not preserve the expected tear mode');
      if (!after.armed) await press('撕扯模式');
    }
    return checks;
  };
  const visibleGap=async()=>{
    const gap=await page.evaluate(interruptDisplay,'visible-frame-gap');
    assert(gap.draws===1 && gap.capturedAfter && gap.intervalMs>=320,'Visible slow frame lost the fresh pull: '+JSON.stringify(gap));
    return gap;
  };
  try {
    const result=await play({page,press,open,back,move,hold:trigger,capture,settle:()=>frames(4),xrInterruptions:{losses:interruptedPulls,visibleGap}});
    await fs.writeFile(path.join(output,'webgpu-xr/result.json'),JSON.stringify({adapters,...result},null,2));
    return result;
  }
  finally { await page.evaluate(()=>{delete window.stockingProbe;}); }
};
module.exports.play = play;
module.exports.writeCrops = writeCrops;
