// node scripts/webgpu-actor/stage-smoke.cjs <local-outfit.pmx> <body.vmd>
//   [--plan <two-site-hand-plan.json>] [--out local-review/screenshots/<run>] [--fallback-only | --paused-hands-only]
// node scripts/webgpu-actor/stage-smoke.cjs --placement-only <local-outfit.pmx> [body.vmd]
// Real prep, backpack, StageRoom, Bullet, GPU and WebGL; simulated XR display
// and inputs. One loopback dev server, one browser, strictly serial renderers.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { parseArgs } = require('node:util');
const stereo = require('../../experiments/gpu-cloth/stereoShim.cjs');
const extend = require('./xr-room-shim.cjs');
const probes = require('./stage-smoke-probes.cjs');
const hands = require('./stage-smoke-hands.cjs');
const pausedTools = require('./stage-smoke-paused.cjs');
const root = path.resolve(__dirname,'../..'), temp = path.join(os.tmpdir(),'opencode');
const center=[0,0,-1.85], offCenter=[.46,0,-2.25];
function atPosition(actual,expected){assert(actual?.length===3 && actual.every((n,i)=>Math.abs(n-expected[i])<.0005),`Expected foot at ${expected}, got ${actual}`);}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals:true, options:{plan:{type:'string'},out:{type:'string'},'fallback-only':{type:'boolean'},'paused-hands-only':{type:'boolean'},'placement-only':{type:'boolean'}} });
  const onlyFallback=!!values['fallback-only'];
  const posed=!!values['paused-hands-only'],onlyPlacement=!!values['placement-only'];
  assert([posed,onlyPlacement,onlyFallback].filter(Boolean).length<=1 && (!posed||values.plan) && !(onlyPlacement&&values.plan),'Choose one focused mode; only hand trials need a plan');
  assert(/\.pmx$/i.test(positionals[0]) && ((positionals.length===2 && /\.vmd$/i.test(positionals[1])) || (onlyPlacement && positionals.length===1)), 'Expected a local clothed PMX and matching body VMD (optional for --placement-only)');
  const [pmx,vmd] = positionals.map(p=>path.resolve(p));
  await fs.access(pmx); if(vmd)await fs.access(vmd);
  const out = values.out && path.resolve(values.out);
  if (out) {
    const privateRoot=path.join(root,'local-review','screenshots'), rel=path.relative(privateRoot,out);
    assert(rel && !rel.startsWith('..') && !path.isAbsolute(rel),'Choose a run folder under local-review/screenshots');
    await fs.mkdir(out,{recursive:true});
  }
  let sites;
  if (values.plan && !onlyFallback) {
    const json=JSON.parse(await fs.readFile(values.plan,'utf8'));
    sites=(json.plan??json).sites?.map(({start,end,spot,radial,marks,mat,bind})=>({start,end,spot,radial,marks,mat,bind}));
    assert(sites?.length===2 && sites.every(s=>Number.isInteger(s.mat) && s.marks?.length && [s.start,s.end,s.spot,s.radial].every(p=>p?.length===3 && p.every(Number.isFinite))), 'Expected two original textured-triangle sites');
  }
  const { chromium }=require(process.env.PLAYWRIGHT_CORE || path.join(process.env.XR_SMOKE_DIR || path.join(temp,'xr-browser-smoke'),'node_modules/playwright-core'));
  const report={display:'local hardware GPU; simulated XR projection and controllers',sessions:[]};
  let server,browser,page,step='start',localProfile=false; const errors=[];
  try {
    const {createServer}=await import('vite');
    server=await createServer({root, configFile:path.join(root,'vite.config.ts'), logLevel:'error',
      // Keep the real React/Fiber dedupe and single-app scan. Include the
      // internal entry as well so a late dependency optimization does not
      // reload the page and replace its real imported File objects mid-take.
      cacheDir:path.join(temp,'vite-r187-stage-smoke'), optimizeDeps:{entries:['scripts/webgpu-actor/stage-room.html']},
      plugins:[hands.driverProbe(!!sites,posed)],server:{host:'127.0.0.1',port:0,fs:{deny:['**/sample/**']}}});
    await server.listen();
    browser=await chromium.launch({channel:process.env.CHANNEL||'msedge',headless:true,args:['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist','--disable-background-timer-throttling']});
    page=await browser.newPage({viewport:{width:1180,height:820}});page.setDefaultTimeout(60000);
    page.on('pageerror',e=>errors.push(e.message));
    const profileUrl=new URL('xr-input/1.0.20/generic-trigger/profile.json',server.resolvedUrls.local[0]).href;
    page.on('response',r=>{if(r.ok() && r.url()===profileUrl)localProfile=true;});
    await page.addInitScript({content:`(${stereo})(); (${extend})();`});
    await page.goto(new URL('scripts/webgpu-actor/stage-room.html',server.resolvedUrls.local[0]).href);
    step='actual prep imports';
    const drop=page.locator('.stage-drop-zone'), folder=path.dirname(pmx);
    await drop.locator('input[webkitdirectory]').setInputFiles(folder);
    const modelPath=path.basename(folder)+'/'+path.basename(pmx), motionName=vmd && path.basename(vmd);
    await page.waitForFunction(p=>Array.from(document.querySelectorAll('#gpu-model option')).some(o=>o.textContent===p),modelPath);
    if(vmd){await drop.locator('input[multiple]:not([webkitdirectory])').setInputFiles(vmd);
      await page.waitForFunction(p=>Array.from(document.querySelectorAll('#gpu-motion option')).some(o=>o.textContent===p),motionName);}
    const ids=await page.evaluate(probes.observeStage,{modelPath,motionName});
    if(posed)await page.evaluate(pausedTools.install,sites);
    await page.locator('#gpu-model').selectOption(ids.model); if(vmd)await page.locator('#gpu-motion').selectOption(ids.motion);
    assert.equal(await page.locator('#gpu-place,#gpu-play').count(),0,'Desktop shortcut bypasses the in-room controls');

    const read=()=>page.evaluate(()=>stageProbe.read());
    async function until(label, test, value=null) {
      step=label;
      // Only local, literal predicates (below) are executed by this observer.
      const check=`(${test})(window.stageProbe.read(), ${JSON.stringify(value)})`;
      await (await page.waitForFunction(check)).dispose(); return read();
    }
    // Wait for a submitted frame with the real button held, then another
    // with it released. A second press while held must never enter the queue.
    async function press(side) {
      await page.evaluate(async side=>{
        const session=labSession, button=session.inputSources.find(s=>s.handedness===side).gamepad.buttons[4];
        let timer;
        try {
          await Promise.race([new Promise((_,no)=>{timer=setTimeout(()=>no(Error('Controller did not reach a submitted XR frame')),12000);}),
            (async()=>{for (const down of [false,true,true,false]) { Object.assign(button,{pressed:down,touched:down,value:+down}); await session.readNextDraw(); }})()]);
        } finally { clearTimeout(timer);Object.assign(button,{pressed:false,touched:false,value:0}); }
      },side);
    }
    async function aim(point) {
      // The pick mesh sits 12 mm above its supporting deck. Direct the XR
      // device's -Z axis through that point, not through a fabricated hit.
      const reads=await page.evaluate(p=>{labSession.aimRay('right',p && [p[0],p[1]+.012,p[2]]);return labSession.stats.targetRayReads.right;},point);
      await until('right targetRaySpace sampled on stage',(s,n)=>s.phase==='active' && labSession.stats.targetRayReads.right>=n+2,reads);
    }
    async function trigger(down) {
      const count=await page.evaluate(d=>{labSession.queueSelect('right',d);return labSession.stats.selectEvents.length;},down);
      return until(down?'hold right trigger across draws':'release right trigger',(s,p)=>{
        const {selectEvents,frames}=labSession.stats,last=selectEvents.at(-1);
        return selectEvents.length>p.count && last.type===p.type && last.side==='right' && frames>=last.frame+2;
      },{count,type:down?'selectstart':'selectend'});
    }
    async function place(point=center,checkInvalid=false) {
      const before=(await read()).placeCommands;
      function draftOnly(s,label){assert(s.draft && !s.live && !s.modelCount && s.actor?.mode==='none' && s.ready && !s.problem && s.placeCommands===before,label);}
      step='X opens placement draft';await press('left');const opened=await read();draftOnly(opened,'X spawned an actor or failed to open the selected PMX draft');
      let invalid;
      if(checkInvalid){
        // This intersects the large pick plane but misses the 8 m plinth.
        await aim([0,0,-10]);await until('formal preview on invalid ground',s=>s.draft && s.previewMs!=null);
        draftOnly(await trigger(true),'Invalid press committed');invalid=await trigger(false);draftOnly(invalid,'Invalid release committed');
      }
      await aim(point);await until('real ground preview before select',s=>s.draft && s.previewMs!=null);
      const held=await trigger(true);draftOnly(held,'Actor or placement command appeared while the trigger was held');
      const released=await trigger(false);assert.equal(released.placeCommands,before+1,'Release must enqueue exactly one place command');
      assert.equal(released.confirmedOn,'selectend','Which XR session event actually produced the backpack command?');
      await aim(null); // Match the empty-eye baseline for subsequent pixel/cloth comparisons.
      assert(localProfile,'Native controller did not load the same-origin generic-trigger profile');
      return {draftAfterX:opened.draft,actorsAfterX:opened.live,invalidCommands:invalid && invalid.placeCommands-before,
        actorsWhileHeld:held.live,heldCommands:held.placeCommands-before,confirmedOn:released.confirmedOn};
    }
    async function gpuActor() {
      const s=await until('actor with native body Bullet and GPU skirt',s=>s.ready && s.live===1 && s.modelCount===1 && s.actor?.mode==='gpu' && s.actor.clothSteps>2 && s.actor.bulletSimulatedSteps>1 && s.actor.updatedBones>0 && s.bullet>0 && s.dynamic>0 && s.dynamic<=s.actor.keptBodies);
      assert(s.filesIntact && s.physics && s.visible && !s.problem); atPosition(s.position,center);
      assert(s.actor.nodes>0 && s.actor.fullBodies>s.actor.keptBodies && s.actor.keptBodies>0,'Expected only matched skirt bodies to leave native Bullet');
      return s;
    }
    async function removed() {
      const s=await until('put-away releases actor and physics counts',s=>s.ready && !s.live && !s.modelCount && s.bullet===0 && s.dynamic===0 && s.actor?.mode==='none');
      for(const key of ['nodes','clothSteps','fullBodies','keptBodies','bulletSteps'])assert.equal(s.actor[key],0,`Retained ${key}`);
      assert(s.filesIntact && !s.playing && s.time===0 && s.duration===0);
      assert.equal(s.floor?.models,0);assert.equal(s.floor?.assets,0);
    }
    const enter=()=>page.locator('#gpu-enter').click();
    async function exit() {
      await page.locator('#gpu-exit').click();
      return until('completed XR teardown',s=>s.phase==='ended' && !s.overlay && !document.querySelector('#gpu-enter').disabled);
    }
    async function active(reversed) {
      await page.evaluate(rev=>{labFixture.reversed=rev;labFixture.tracking=true;labFixture.reject=false;},reversed);
      await enter(); await until('first tracked draw and stage mount',s=>s.phase==='active' && s.ready && !!labSession.first);
      const {different,light}=await page.evaluate(()=>labSession.first);
      assert(different>100 && light.every(n=>n>100),'First tracked draw did not show the plinth in stereo');
      const stats=await page.evaluate(()=>labSession.stats);
      assert.equal(stats.layers,1);assert.equal(stats.maxPending,1);assert(stats.references.includes('local-floor'));
      assert.deepEqual(stats.slices,{left:Number(reversed),right:Number(!reversed)});
      const row={reversed,first:{different,light},slices:stats.slices};report.sessions.push(row);return row;
    }
    const empty=await read();assert(!empty.live && !empty.modelCount && empty.filesIntact && !empty.floor && !empty.hasBinding,'Selection spawned or bound an actor');
    const row=await active(false);
    const initial=await read();assert(initial.live===0 && initial.actor?.mode==='none' && initial.duration===0 && initial.room==='floor');
    // Wait until the empty room has published its initial complete layout. No
    // model access / light-pole color assumptions are used for the baseline.
    await until('initial empty floor',s=>s.floor?.assets===0 && s.frames>5);
    row.floor=await page.evaluate(probes.inspectEyes,'empty');
    function checkEyeOrder(p) {
      assert(p.different>100 && p.controls.every(n=>n===0),'Empty room failed same-pose or stereo control');
      assert(p.matched.every((v,i)=>v<p.crossed[i]*.4),'Final XR slices do not match physical left/right poses');
    }
    checkEyeOrder(row.floor);
    async function fallback(expectedFull) {
      await page.evaluate(()=>{labFixture.driverFailures=0;labFixture.failNextDriver=true;});
      await place();
      const b=await until('failed driver preserves complete native Bullet',s=>s.ready && !s.problem && s.live===1 && s.modelCount===1 && s.visible && s.actor?.mode==='bullet' && s.actor.cloth==='failed' && s.actor.nodes>0 && s.actor.clothSteps===0 && s.dynamic>0 && s.bullet>0);
      assert.equal(await page.evaluate(()=>labFixture.driverFailures),1);assert(b.filesIntact && b.physics);atPosition(b.position,center);
      assert.equal(b.actor.fullBodies,b.actor.keptBodies);assert(b.actor.keptBodies>b.actor.nodes);
      if(expectedFull)assert.equal(b.actor.fullBodies,expectedFull);
      const b2=await until('native physics continues after failed GPU initialization',(s,t)=>s.bullet>t && s.actor.mode==='bullet' && s.actor.clothSteps===0,b.bullet);
      assert.equal(b2.actor.fullBodies,b2.actor.keptBodies);assert.equal(b2.actor.fullBodies,b.actor.fullBodies);
      const image=await page.evaluate(probes.inspectEyes,'actor');
      assert(image.characterPixels.every(n=>n>250) && image.different>100 && image.mono===0,'Native fallback actor missing from final eye images');
      report.driverFailure={injections:1,full:b.actor.fullBodies,kept:b2.actor.keptBodies,bullet:[b.bullet,b2.bullet],cloth:b2.actor.clothSteps,image};
      await press('left');await removed();
    }
    async function finish() {
      const adapters=await page.evaluate(()=>labFixture.adapters);
      assert(adapters.length && adapters.every(a=>a.xrCompatible && a.vendor && !a.fallback && !/software|swiftshader|warp|llvmpipe/i.test(JSON.stringify(a))),'Hardware XR-compatible WebGPU not verified');
      assert.deepEqual(errors,[]); report.hardwareAdapters=adapters.length;
      if(out)await fs.writeFile(path.join(out,'summary.json'),JSON.stringify(report,null,2)+'\n');
      console.log(JSON.stringify(report,null,2));
    }
    async function restoreWebGL(seed,duration) {
      step='restore in actual WebGL prep viewer';
      await page.evaluate(()=>{window.beforeScreenSession=labSession;});
      await page.locator('.stage-launch-row .stage-btn-secondary').first().click();
      const glState=await until('WebGL actor and layout restored',(s,bound)=>s.overlay && s.presentation==='screen' && s.ready && s.modelCount===1 && s.live===1 && s.hasBinding===bound && (bound?s.duration>0:s.duration===0),seed.hasMotion);
      assert(glState.filesIntact && glState.visible && !glState.problem && !glState.playing && glState.physics);
      atPosition(glState.position,seed.position);assert.equal(glState.time,seed.time);assert.equal(glState.duration,duration);
      const canvas=page.locator('.screen-picture canvas');
      assert(await canvas.evaluate(el=>{const gl=window.screenSmokeContext=el.getContext('webgl2');return !!gl && !gl.isContextLost() && gl.drawingBufferWidth>0 && gl.drawingBufferHeight>0;}));
      await page.locator('.screen-corner button[aria-expanded]').click();await page.locator('.screen-item').nth(ids.index).click();
      const toggle=page.locator('.screen-actor-home > .screen-buttons button').nth(1);
      const shown=await canvas.screenshot();await toggle.click();await until('screen hide control',s=>s.visible===false);
      const hidden=await canvas.screenshot(); await toggle.click();await until('restore screen actor',s=>s.visible===true);
      const glPixels=await page.evaluate(probes.screenDiff,[shown,hidden].map(b=>b.toString('base64')));
      assert(glPixels>250,'Restored model did not change the actual WebGL canvas');
      if(seed.hasMotion){
        await page.locator('.screen-play').click();await until('real WebGL transport resumes restored VMD',(s,t)=>s.playing && s.time>t+.06,seed.time);
        await page.locator('.screen-play').click();await until('WebGL paused again',s=>!s.playing);
      }
      report.webgl={position:glState.position,characterPixels:glPixels,restoredTime:glState.time,duration:glState.duration};
      assert(await page.evaluate(()=>window.beforeScreenSession===labSession));
      await page.locator('.screen-back').click();return until('back from WebGL',s=>!s.overlay && !s.live && screenSmokeContext.isContextLost());
    }
    if(onlyFallback){await fallback();await exit();await finish();return;}
    if(onlyPlacement){
      const witness=await place(offCenter,true);
      const model=await until('selected PMX evaluated at ray landing',s=>s.ready && s.selected && s.visible && s.modelCount===1 && s.live===1 && s.actor?.evaluations>0);
      assert(model.filesIntact && !model.problem && !model.hasBinding && model.placeCommands===1);
      atPosition(model.position,offCenter);
      const image=await page.evaluate(probes.inspectEyes,'actor');
      assert(image.mono===0 && image.different>100 && image.characterPixels.every(n=>n>250),'Off-center actor did not draw in both final eyes');
      const events=await page.evaluate(()=>labSession.stats.selectEvents);
      const {floor}=await exit();assert(floor?.hasModel && floor.assets===1 && floor.models===1 && !floor.hasMotion);atPosition(floor.position,offCenter);
      report.placement={...witness,requested:offCenter,placed:model.position,saved:floor.position,events,placeCommands:model.placeCommands,image};
      const restored=await restoreWebGL(floor,0);atPosition(restored.floor.position,offCenter);
      await finish();return;
    }
    await place(); const actor=await gpuActor(); assert(!actor.hasBinding && !actor.playing && actor.duration===0,'Selecting VMD bound it before A');
    row.physics={dynamic:actor.dynamic,bullet:actor.bullet,kept:actor.actor.keptBodies,full:actor.actor.fullBodies,cloth:actor.actor.clothSteps,nodes:actor.actor.nodes};
    row.actor=await page.evaluate(probes.inspectEyes,'actor');
    assert(row.actor.mono===0 && row.actor.different>100 && row.actor.characterPixels.every(n=>n>250),'Actor not visible independently in both final color layers');
    if(posed){
      await press('right');await until('playing before two-hand pause',s=>s.playing&&s.hasBinding&&s.time>.25);await press('right');
      await page.evaluate(async()=>{const {useMmdVrStore}=await import('/src/mmdVrShowcase/mmdVrStore.ts');useMmdVrStore.getState().requestSeek(.4);});
      const frozen=await until('paused dance for same-actor hand trials',s=>!s.playing&&s.time===.4&&s.time===s.actor.poseSeconds);
      const pose={time:frozen.time,id:frozen.runtimeId};assert(pose.id && frozen.selected);await page.evaluate(pausedTools.register,{sites,pose});
      for(const name of ['empty','left','right','both']){
        step='paused dance hands: '+name;await page.evaluate(hands.trial,{name,sites,pose});
      }
      const {images,...proof}=await page.evaluate(hands.compare,!!out);report.hands=proof;
      if(out)for(const [name,png] of Object.entries(images))await fs.writeFile(path.join(out,name+'.png'),Buffer.from(png,'base64'));
      console.log('Paused pose lift (mm):',JSON.stringify(proof.lift));hands.check(proof);
      await press('right');await until('same VMD resumes after two-hand release',(s,p)=>s.selected&&s.runtimeId===p.id&&s.playing&&s.hasBinding&&s.time>p.time+.06&&s.actor.poseSeconds>p.time+.06,pose);
      await press('left');await removed();await exit();report.pausedAt=frozen.time;await finish();return;
    }
    if (sites) {
      for (const [i,name] of ['empty','left','right','both'].entries()) {
        if(i) {await press('left');await removed();await place();await gpuActor();}
        step='two-hand cloth: '+name; await page.evaluate(hands.trial,{name,sites});
      }
      const {images,...proof}=await page.evaluate(hands.compare,!!out);report.hands=proof;
      if(out) for(const [name,png] of Object.entries(images))await fs.writeFile(path.join(out,name+'.png'),Buffer.from(png,'base64'));
      hands.check(proof);
    }
    step='A binds VMD and starts playing'; await press('right');
    await until('VMD starts on the shared clock',s=>s.playing && s.hasBinding && s.duration>0 && s.time>.1 && s.actor.poseSeconds>0);
    await press('right'); const held=await until('A pauses shared clock',s=>!s.playing && s.hasBinding && s.time>0 && s.time<s.duration);
    const later=await until('paused pose while both solvers advance',(s,p)=>s.actor.clothSteps>p[0]+6 && s.bullet>p[1], [held.actor.clothSteps,held.bullet]);
    assert.equal(later.time,held.time);assert(Math.abs(later.actor.poseSeconds-held.time)<1e-6);
    // A held across tracking loss and reacquisition must not become a new
    // press. Check real submitted eyes and the same frozen pose after return.
    step='tracking interruption';
    const missing=await page.evaluate(()=>{labFixture.tracking=false;labSession.inputSources.find(s=>s.handedness==='right').gamepad.buttons[4].pressed=true;return labSession.stats.frames;});
    await page.waitForFunction(n=>labSession.stats.frames>=n+3,missing);
    await page.evaluate(()=>{labFixture.tracking=true;});
    await until('tracked frame returns without phantom A',(s,n)=>s.actor.clothSteps>n+4,later.actor.clothSteps);
    const recovered=await read();assert(!recovered.playing && recovered.time===held.time);
    await press('right');await until('A resumes existing VMD',(s,t)=>s.hasBinding && s.playing && s.time>t+.06,held.time);
    await press('right');const paused=await until('pause for layout handoff',s=>!s.playing && s.time>0 && s.time<s.duration);
    row.motion={duration:paused.duration,held:held.time,resumed:paused.time};
    const parked=await exit(), seed=parked.floor;
    assert(seed?.hasModel && seed.hasMotion && seed.assets===1 && seed.models===1 && seed.physics && !seed.playing && seed.time===paused.time);
    atPosition(seed.position,center);assert(parked.hasBinding && parked.filesIntact);
    function retained(s) {assert.deepEqual(s.floor,seed);assert.deepEqual(s.saved,parked.saved);assert(s.hasBinding && s.filesIntact && !s.live && !s.overlay);}
    await page.evaluate(()=>{labFixture.reject=true;});await enter();
    retained(await until('refused XR retains seeded floor and bindings',s=>s.phase==='failed' && !document.querySelector('#gpu-enter').disabled));
    assert.match(await page.evaluate(()=>stageRoomTest.status.error),/user rejected|NotAllowedError/i);report.deniedPreserved=true;
    await page.evaluate(()=>{labFixture.reject=false;labFixture.tracking=false;});await enter();
    retained(await until('no first pose retains floor while waiting',s=>s.phase==='waiting' && labSession.stats.frames>=2));
    assert.equal(await page.evaluate(()=>!!labSession.first||labSession.stats.submissions>0),false);
    retained(await exit());report.cancelledPreserved=true;

    const fromScreen=await restoreWebGL(seed,paused.duration);
    assert(fromScreen.floor?.hasMotion && !fromScreen.floor.playing);
    const rev=await active(true),restored=await gpuActor();assert(restored.hasBinding && !restored.playing);
    assert.equal(restored.time,fromScreen.floor.time);assert.equal(restored.duration,paused.duration);
    await press('left');await removed();
    rev.floor=await page.evaluate(probes.inspectEyes,'empty');checkEyeOrder(rev.floor);
    await fallback(actor.actor.fullBodies);
    // The previously saved bound actor had to be *restored* before X could
    // remove it. Check its absence from the real saved floor on final exit.
    const final=await exit();assert.equal(final.floor?.assets,0);assert.equal(final.floor.models,0);assert(final.filesIntact);
    rev.removed=true;
    await finish();
  } catch(e) {
    // Local diagnostic only; do not print the imported file catalog or dump
    // a private screenshot by default. Retain the last good stage, not a hang.
    const last=await page?.evaluate(()=>window.stageProbe?.read()).catch(()=>null);
    const input=await page?.evaluate(()=>{const stats=window.labSession?.stats;return stats && {rayReads:stats.targetRayReads,events:stats.selectEvents};}).catch(()=>null);
    if(out)await fs.writeFile(path.join(out,'incomplete.json'),JSON.stringify({step,report,input,localProfile},null,2)+'\n').catch(()=>{});
    console.error('Stage smoke stopped at:',step,JSON.stringify({last,input,localProfile,pageErrors:errors.length})); throw e;
  } finally { try { await browser?.close(); } finally { await server?.close(); } }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
