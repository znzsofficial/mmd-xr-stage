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
async function play({page,press,back,open,move,hold,capture,settle,whileTorn}) {
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
  await move(route[0]); await hold(true);
  try { for (const p of route.slice(1)) await move(p);
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
  await press('换新一双'); await wait('Replace pair did not reset damage',s=>s.worn && !s.tears.length && !s.armed);
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
  return {source,pose,restored,fresh};
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
  const open=async()=>{await click('actorWardrobe');await press('黑色长筒袜');};
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
  try {
    const result=await play({page,press,open,back,move,hold:trigger,capture,settle:()=>frames(4)});
    await fs.writeFile(path.join(output,'webgpu-xr/result.json'),JSON.stringify({adapters,...result},null,2));
    return result;
  }
  finally { await page.evaluate(()=>{delete window.stockingProbe;}); }
};
module.exports.play = play;
module.exports.writeCrops = writeCrops;
