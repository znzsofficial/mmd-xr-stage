// node scripts/webgpu-actor/game-floor-smoke.cjs <local-clothed.pmx> <body.vmd> <two-site-hand-plan.json>
// Product /?xrBackend=webgpu only. Two library identities, one live actor,
// one hardware renderer at a time. No injected menu, store actions or shortcut.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const stereo = require('../../experiments/gpu-cloth/stereoShim.cjs');
const extend = require('./xr-room-shim.cjs');
const probes = require('./stage-smoke-probes.cjs');
const hands = require('./stage-smoke-hands.cjs');
const root = path.resolve(__dirname, '../..'), temp = path.join(os.tmpdir(), 'opencode');
const first = 'A-swatch.pmx', second = 'B-actor.pmx', motion = 'body.vmd', landing = [0, 0, -1.85];

// Observe the status returned by the public host, never call it from the test.
function hostProbe() {
  return { name: 'observe-game-floor-handle', enforce: 'pre', transform(src, id) {
    if (!id.split('?')[0].replaceAll('\\','/').endsWith('/prep/useFloorBackend.ts')) return;
    const at='current.current=host;';
    assert.equal(src.split(at).length,2,'Update read-only observer of the prep-owned floor session');
    return src.replace(at, at+'window.labFixture.hostStatus=()=>host.status;');
  }};
}

// Import a normal folder, including the original texture tree. Keep unrelated
// actors and animations in the user's source folder outside this two-row take.
async function makeImport(folder, pmx, vmd) {
  const {makeSwatch} = await import('../../experiments/gpu-cloth/swatch.js');
  await fs.cp(path.dirname(pmx), folder, {recursive:true, filter:async file => {
    const stat = await fs.lstat(file);
    return stat.isDirectory() || stat.isFile() && /\.(png|tga|bmp|jpe?g|gif|webp|dds|spa|sph)$/i.test(file);
  }});
  await Promise.all([fs.writeFile(path.join(folder,first), new Uint8Array(await makeSwatch().arrayBuffer())),
    fs.copyFile(pmx,path.join(folder,second)), fs.copyFile(vmd,path.join(folder,motion))]);
}

async function main() {
  const [pmx, vmd, plan] = process.argv.slice(2).map(v => path.resolve(v));
  assert(pmx && vmd && plan, 'Expected a clothed PMX, body VMD and a matching textured-triangle hand plan');
  const json = JSON.parse(await fs.readFile(plan, 'utf8'));
  const sites = (json.plan ?? json).sites.map(({start,end,spot,radial,marks,mat}) => ({start,end,spot,radial,marks,mat}));
  assert.equal(sites.length, 2);
  const {chromium} = require(process.env.PLAYWRIGHT_CORE || path.join(process.env.XR_SMOKE_DIR || path.join(temp,'xr-browser-smoke'),'node_modules/playwright-core'));
  const folder = await fs.mkdtemp(path.join(temp,'game-floor-files-'));
  const report = {entry:'/?xrBackend=webgpu', simulated:'Quest controller input and projection display'};
  const errors = [], consoles = [];
  let server, browser, page, step = 'prepare', localProfile = false;
  try {
    await makeImport(folder,pmx,vmd);
    const {createServer} = await import('vite');
    server = await createServer({root, logLevel:'error', cacheDir:path.join(temp,'vite-game-floor-smoke'),
      optimizeDeps:{include:['three/webgpu','three/tsl','@yohawing/three-mmd-loader/webgpu']},
      plugins:[hostProbe(), hands.driverProbe(true)], server:{host:'127.0.0.1',port:0,hmr:false,fs:{deny:['**/sample/**']}}});
    await server.listen();
    browser = await chromium.launch({channel:process.env.CHANNEL || 'msedge', headless:true,
      args:['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist','--disable-background-timer-throttling']});
    page = await browser.newPage({locale:'zh-CN', viewport:{width:1180,height:820}}); page.setDefaultTimeout(20000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {if (m.type()==='error') consoles.push(m.text().slice(0,350));});
    const href = new URL(report.entry,server.resolvedUrls.local[0]);
    page.on('response', r => {if(r.ok() && r.url()===new URL('/xr-input/1.0.20/meta-quest-touch-plus/profile.json',href).href)localProfile=true;});
    await page.addInitScript({content:`(${stereo})(); (${extend})(); labFixture.controllerProfile='meta-quest-touch-plus'; labFixture.hostStatus=()=>({phase:'idle'});`});
    await page.goto(href.href);
    await page.locator('.stage-first-room select').selectOption('floor');
    await page.locator('.stage-drop-zone input[webkitdirectory]').setInputFiles(folder);
    await page.locator('.stage-report-stats').waitFor();
    const ids = await page.evaluate(probes.observeStage,{modelPath:`${path.basename(folder)}/${second}`,motionName:`${path.basename(folder)}/${motion}`});
    assert.equal(ids.index,1); assert(ids.motion);
    await page.evaluate(async () => {window.gameTargets=await import('/scripts/webgpu-actor/game-floor-targets.js');});

    const read = () => page.evaluate(() => stageProbe.read());
    async function until(label, predicate, arg = null, timeout = 20000) {
      step = label;
      const check = `(s => {if (s.phase==='failed'||s.problem) throw Error('Stage reported a failure during '+${JSON.stringify(label)});return (${predicate})(s,${JSON.stringify(arg)})})(stageProbe.read())`;
      await (await page.waitForFunction(check,null,{timeout})).dispose(); return read();
    }
    async function target(spec) {
      step = 'find '+(spec.key ?? spec.name);
      const handle = await page.waitForFunction(s => gameTargets.find(s),spec);
      try {return await handle.jsonValue();} finally {await handle.dispose();}
    }
    const frameCount = () => window.labSession.stats.frames;
    async function frames(n=2) {
      const until = await page.evaluate(frameCount)+n;
      await (await page.waitForFunction(n=>labSession.stats.frames>=n,until)).dispose();
    }
    async function bButton() {
      step = 'physical B recalls the shared control bar';
      for(const down of [false,true,false]) {
        await page.evaluate(value => {const b=labSession.inputSources.find(s=>s.handedness==='right').gamepad.buttons[5];
          Object.assign(b,{pressed:value,touched:value,value:+value});},down);
        await frames();
      }
      await target({name:'hud:panel-drag'}); assert(localProfile,'B must be supplied by the local Quest controller profile');
    }
    // A high controller aims DOWN through the bag row at valid ground behind
    // it. A HUD release leaking into the new placement surface is detectable.
    const handOrigin={x:.17,y:1.95,z:-.42};
    async function aim(point) {
      const reads=await page.evaluate(([at,from])=>{labSession.aimRay('right',at,from);return labSession.stats.targetRayReads.right;},[point,handOrigin]);
      await (await page.waitForFunction(n=>labSession.stats.targetRayReads.right>=n+2,reads)).dispose(); await frames();
    }
    async function trigger(down, retiring=false) {
      const count=await page.evaluate(d=>{labSession.queueSelect('right',d);return labSession.stats.selectEvents.length;},down);
      await (await page.waitForFunction(([n,type])=>labSession.stats.selectEvents.length>n && labSession.stats.selectEvents.at(-1).type===type,[count,down?'selectstart':'selectend'])).dispose();
      if(!retiring)await frames();
    }
    async function click(key, opts={}) {
      await aim(await target({key}));step='ray clicks '+key;await trigger(true);await trigger(false,opts.retiring);
    }
    async function idleRay() {await aim(null);}
    async function pickMounted(id) {
      await aim(await target({name:`backpack:pick:${id}`}));await trigger(true);await trigger(false);
    }
    async function placeFromBag(name,point,before) {
      await bButton();await click('hudBackpack');await target({name:'hud-backpack'});
      const row=await target({key:'hudPlace',row:name});
      assert(await page.evaluate(n=>!!gameTargets.find({key:'hudPlace',row:n}),name===first?second:first));
      const k=(.012-handOrigin.y)/(row[1]-handOrigin.y);
      assert(k>1 && Math.hypot(handOrigin.x+k*(row[0]-handOrigin.x),handOrigin.z+k*(row[2]-handOrigin.z))<7.9,'Aim the bag row over valid plinth ground');
      await aim(row);await trigger(true);assert(!await page.evaluate(n=>gameTargets.model(n).draft,name));
      let s=await read();assert(!s.live && !s.modelCount && s.placeCommands===before);
      await trigger(false);await until('bag row opens only its draft',(s,[n,b])=>gameTargets.model(n).draft && !s.live && !s.modelCount && s.placeCommands===b,[name,before]);
      await aim([point[0],.012,point[2]]);await until('real ground preview',(s,n)=>gameTargets.model(n).draft && s.previewMs!=null,name);
      await trigger(true);s=await read();assert(!s.live && s.placeCommands===before && s.filesIntact);
      await trigger(false);assert.equal((await read()).placeCommands,before+1);
    }

    const empty=await read();assert(empty.filesIntact && !empty.floor && !empty.live && !empty.hasBinding && empty.room==='floor');
    step='original VR launch';await page.locator('.stage-launch-row button.stage-btn-primary[data-xr-backend="webgpu"]').click();
    await until('real floor active',s=>s.phase==='active' && s.ready && s.floor?.assets===0 && !!labSession.first && !!document.querySelector('[data-xr-host="webgpu"][data-phase="active"]'));
    assert.deepEqual(await page.evaluate(()=>labSession.stats.slices),{left:0,right:1});

    // Dismiss the one-time intro so the first B press has to actually work.
    if(await page.evaluate(()=>!!gameTargets.find({key:'hudBack'})))await click('hudBack');
    await target({name:'watch:quiet'});await idleRay();
    report.emptyEyes=await page.evaluate(probes.inspectEyes,'empty');
    const base=report.emptyEyes;assert(base.different>100 && base.controls.every(n=>n===0) && base.matched.every((n,i)=>n<base.crossed[i]*.4),'Wrong final XR eye assignment');

    await placeFromBag(second,landing,0);
    const actor=await until('selected second PMX on GPU cloth and native Bullet',s=>s.ready && s.selected && s.live===1 && s.modelCount===1 && s.actor?.mode==='gpu' && s.actor.clothSteps>2 && s.actor.bulletSimulatedSteps>1,null,60000);
    assert(actor.visible && actor.filesIntact && !actor.hasBinding && actor.placeCommands===1 && actor.confirmedOn==='selectend');
    const atFoot = (point,at=landing) => assert(point?.length===3 && point.every((n,i)=>Math.abs(n-at[i])<.0005),`Unexpected placed foot: ${point}`);
    atFoot(actor.position);report.placement={row:2,commands:actor.placeCommands,confirmedOn:actor.confirmedOn,at:actor.position};
    await click('hudDone');await target({name:'watch:quiet'});await idleRay();
    report.actorEyes=await page.evaluate(probes.inspectEyes,'actor');assert(report.actorEyes.mono===0 && report.actorEyes.characterPixels.every(n=>n>250) && report.actorEyes.different>100,'Actor missing from one or both final color layers');

    // Replay the known original-triangle take in THIS product room. Change
    // only device grip poses, holding actor, material, camera and clock fixed.
    for(const name of ['empty','both']){step='original skirt '+name;await page.evaluate(hands.trial,{name,sites});}
    const {lift,pixels,grips}=await page.evaluate(hands.compare,false); const l=lift.both;
    assert.deepEqual(grips.empty.hold,['missing','missing']);assert.deepEqual(grips.both.hold,['grip','grip']);
    assert.deepEqual(grips.both.withdrawLeft,['missing','grip']);assert.deepEqual(grips.both.release,['missing','missing']);
    assert(l.hold.every(n=>n>18) && Math.abs(l.withdrawLeft[0])<14 && l.withdrawLeft[1]>18 && l.release.every(n=>Math.abs(n)<12),JSON.stringify(l));
    assert(pixels.both.every((pair,i)=>pair.every((n,j)=>n>10 && n>pixels.released[i][j])) && pixels.withdraw.every(pair=>pair[1]>10),JSON.stringify(pixels));
    report.handReplay={liftMm:l,eyePatchPixels:pixels};

    await pickMounted(ids.model);
    await until('actual ray selects mounted actor',s=>s.selected);await click('hudChangeMotion');await click('hudApplyBody');
    await until('selected actor body VMD on the running shared clock',(s,id)=>s.selected && s.hasBinding && s.ready && s.playing && s.time>.1 && s.actor.poseSeconds>0 && s.runtimeId===id,actor.runtimeId);
    await bButton();await click('settingsMmdVrPause');
    const paused=await until('HUD transport pauses evaluated actor',s=>s.ready && !s.playing && s.hasBinding && s.time>0 && s.time<s.duration && Math.abs(s.actor.poseSeconds-s.time)<1e-5);
    await frames(6);assert.equal((await read()).time,paused.time);
    await bButton();await click('settingsMmdVrPlay');await until('HUD resumes same actor and motion',(s,t)=>s.hasBinding && s.playing && s.time>t+.06,paused.time);
    await bButton();await click('settingsMmdVrPause');const stopped=await until('pause for handoff',s=>!s.playing && s.ready && s.hasBinding);
    await bButton();await click('settingsVrDesktopExit',{retiring:true});
    const end=await until('WebGPU host and XR room retired',s=>s.phase==='ended' && !s.overlay && !s.live);
    const saved=end.floor;assert(saved?.assets===1 && saved.models===1 && saved.hasModel && saved.hasMotion && !saved.playing && saved.time===stopped.time && end.filesIntact);atFoot(saved.position);
    report.xr={pausedAt:stopped.time,duration:stopped.duration,selectEvents:await page.evaluate(()=>labSession.stats.selectEvents.length)};

    step='original WebGL screen entry';await page.locator('.stage-launch-row button.stage-btn-secondary').first().click();
    const gl=await until('same files, actor, VMD and paused time in actual WebGL room',s=>s.presentation==='screen' && s.overlay && s.ready && s.modelCount===1 && s.live===1 && s.hasBinding && s.duration>0,null,60000);
    assert(gl.filesIntact && gl.visible && !gl.playing && gl.duration===stopped.duration && gl.time===stopped.time);atFoot(gl.position);
    const canvas=page.locator('.screen-picture canvas');assert(await canvas.evaluate(c=>{const gl=labFixture.screenContext=c.getContext('webgl2');return !!gl && !gl.isContextLost() && gl.drawingBufferWidth>0;}));
    await page.locator('.screen-corner button[aria-expanded]').click();await page.locator('.screen-item').filter({hasText:second}).click();
    const toggle=page.locator('.screen-actor-home > .screen-buttons button').nth(1);
    const shown=await canvas.screenshot();await toggle.click();await until('hide restored WebGL actor',s=>s.visible===false);
    const hidden=await canvas.screenshot();await toggle.click();await until('show same WebGL actor',s=>s.visible===true);
    const changed=await page.evaluate(probes.screenDiff,[shown,hidden].map(b=>b.toString('base64')));assert(changed>250);
    await page.locator('.screen-play').click();await until('WebGL VMD advances beyond restored time',(s,t)=>s.playing && s.time>t+.06,gl.time);
    await page.locator('.screen-play').click(); const heldGL=await until('pause B before returning to WebGPU',s=>!s.playing);
    await page.locator('.screen-back').click();report.webgl={restoredAt:gl.time,characterPixels:changed};
    await until('WebGL renderer released',s=>!s.overlay && !s.live && labFixture.screenContext.isContextLost());

    step='original VR continue with B';await page.locator('.stage-launch-row button.stage-btn-secondary[data-xr-backend="webgpu"]').click();
    const resumed=await until('same B before put-away',(s,t)=>s.phase==='active' && s.ready && s.runtimeId && s.live===1 && s.hasBinding && !s.playing && s.time===t && s.actor?.evaluations>0,heldGL.time,60000);
    assert(resumed.filesIntact);assert.deepEqual(await page.evaluate(n=>gameTargets.model(n).mounted,second),[resumed.runtimeId]);
    await pickMounted(ids.model);await click('watchArrange');await click('hudPutAway');
    const removed=await until('B and its runtime leave the floor',s=>s.ready && !s.live && !s.modelCount && !s.duration && !s.playing && s.floor?.assets===0 && s.actor?.mode==='none' && s.actor.nodes===0);
    assert(removed.filesIntact && removed.hasBinding);assert.deepEqual(await page.evaluate(n=>gameTargets.model(n).mounted,second),[]);
    await target({name:'watch:quiet'});await idleRay();await page.evaluate(probes.inspectEyes,'baseline');
    const otherLanding=[.22,0,-1.95];await placeFromBag(first,otherLanding,1);
    const swapped=await until('A is the only placed evaluated actor',(s,n)=>{const a=gameTargets.model(n);return s.ready && s.live===1 && s.modelCount===1 && !s.runtimeId && a.selected && a.visible && a.soleFile && s.actor.evaluations>0;},first,60000);
    const a=await page.evaluate(n=>gameTargets.model(n),first);
    assert.notEqual(a.runtime,resumed.runtimeId);assert.deepEqual(a.mounted,[a.runtime]);atFoot(a.foot,otherLanding);
    assert(swapped.filesIntact && swapped.hasBinding && !swapped.time && !swapped.duration && !swapped.playing && swapped.confirmedOn==='selectend');
    await click('hudDone');await target({name:'watch:quiet'});await idleRay();
    const eyesA=await page.evaluate(probes.inspectEyes,'actor');assert(eyesA.mono===0 && eyesA.characterPixels.every(n=>n>250) && eyesA.different>100);
    await bButton();await click('settingsVrDesktopExit',{retiring:true});
    const final=await until('save only A after swap',s=>s.phase==='ended' && !s.overlay && !s.live && s.floor?.assets===1 && !s.floor.hasModel);
    assert(final.filesIntact && await page.evaluate(n=>gameTargets.model(n).soleFile,first));
    report.swap={resumedBAt:resumed.time,afterRemoval:removed.live,mountedWithA:a.mounted.length,at:a.foot,characterPixels:eyesA.characterPixels,filesIntact:final.filesIntact};
    const adapters=await page.evaluate(()=>labFixture.adapters);
    assert(adapters.some(a=>a.xrCompatible) && adapters.every(a=>a.vendor && !a.fallback && !/swiftshader|warp|software|llvmpipe/i.test(JSON.stringify(a))),'No verified hardware GPU');
    assert.deepEqual(errors,[]); console.log(JSON.stringify(report,null,2));
  } catch(e) {
    const last=await page?.evaluate(()=>({state:window.stageProbe?.read(),hostError:window.labFixture?.hostStatus?.()?.error,
      frames:window.labSession?.stats?.frames,triggers:window.labSession?.stats?.selectEvents?.slice(-5)})).catch(()=>null);
    console.error('Stopped at:',step, JSON.stringify({last,localProfile,errors,consoles:consoles.slice(-3),report})); throw e;
  } finally {
    try {await browser?.close();} finally {try {await server?.close();} finally {await fs.rm(folder,{recursive:true,force:true});}}
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
