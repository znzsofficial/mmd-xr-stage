// From the repo root: node scripts/webgpu-actor/xr-room-smoke.cjs [local-clothed.pmx]
// No argument = generated fitting swatch, NOT evidence about an imported outfit.
// One loopback Vite server, one Edge process; no production build or dependencies added.
const assert = require('node:assert/strict'), fs = require('node:fs/promises');
const path = require('node:path'), os = require('node:os');
const root = path.resolve(__dirname, '../..'), temp = path.join(os.tmpdir(), 'opencode');
const pw = process.env.PLAYWRIGHT_CORE || path.join(process.env.XR_SMOKE_DIR || path.join(temp, 'xr-browser-smoke'), 'node_modules/playwright-core');
const { chromium } = require(pw);
const stereo = require('../../experiments/gpu-cloth/stereoShim.cjs'), extend = require('./xr-room-shim.cjs');

async function main() {
  let server, browser, generated, page;
  const report = { display: 'simulated local-floor; hardware WebGPU readback, no headset compositor',
    model: process.argv[2] ? 'picked-local-pmx' : 'generated-swatch', sessions: [] }, errors = [];
  try {
    let pmx = process.argv[2] && path.resolve(process.argv[2]);
    if (!pmx) {
      const { makeSwatch } = await import('../../experiments/gpu-cloth/swatch.js');
      const file = makeSwatch(); await fs.mkdir(temp, { recursive: true });
      generated = await fs.mkdtemp(path.join(temp, 'xr-room-swatch-')); pmx = path.join(generated, file.name);
      await fs.writeFile(pmx, new Uint8Array(await file.arrayBuffer()));
    }
    await fs.access(pmx);
    let url = process.env.XR_ROOM_URL;
    if (url && process.env.XR_ROOM_HAND_PLAN) throw Error('Let this fixture start its instrumented local server for cloth measurements');
    if (!url) {
      const { createServer } = await import('vite');
      server = await createServer({ root, configFile: false, logLevel: 'error', cacheDir: path.join(temp, 'vite-xr-room-r187'),
        plugins: !process.env.XR_ROOM_HAND_PLAN ? [] : [{name:'sample-skinned-cloth-test-only',enforce:'pre',transform(src,id){
          if(!id.replaceAll('\\','/').endsWith('/scripts/webgpu-actor/roomCloth.js'))return;
          const step='log.clothSteps += driver.step(dt, palms);';assert(src.includes(step));
          return src.replace(step,step+'window.labFixture?.take?.measure(renderer.backend.device,model.mesh,rig,surface);');
        }}],resolve: { dedupe: ['three'] }, optimizeDeps: { entries: ['scripts/webgpu-actor/xr-room.html'] },
        server: { host: '127.0.0.1', port: 0, fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/sample/**', '**/local-review/**', '**/.openchamber/**'] } } });
      await server.listen(); url = new URL('scripts/webgpu-actor/xr-room.html', server.resolvedUrls.local[0]).href;
    }
    browser = await chromium.launch({ channel: process.env.CHANNEL || 'msedge', headless: true,
      args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--disable-background-timer-throttling'] });
    page = await browser.newPage(); page.setDefaultTimeout(45000);
    page.on('pageerror', e => errors.push(e.stack || e.message));
    await page.addInitScript({ content: `(${stereo})(); (${extend})();` });
    await page.goto(url); await page.waitForFunction(() => !!window.xrRoom);
    await page.locator('#folder').setInputFiles(path.dirname(pmx));
    const name = path.basename(pmx), selected = await page.locator('#pmx option').evaluateAll((opts, { name, folder }) => {
      const v = opts.map(o => o.value); return v.find(p => p === `${folder}/${name}`) ?? v.find(p => p === name);
    }, { name, folder: path.basename(path.dirname(pmx)) });
    assert(selected, 'Cannot find the named PMX in the selected directory');
     await page.locator('#pmx').selectOption(selected);
     if (process.env.XR_ROOM_VMD) await page.locator('#motion').setInputFiles(process.env.XR_ROOM_VMD);
    const enter = () => page.locator('#enter').click();
    await page.evaluate(() => { labFixture.reject = true; }); await enter();
    await page.waitForFunction(() => xrRoom.status.phase === 'failed');
    report.denied = await page.evaluate(() => xrRoom.status);
    assert.match(report.denied.error, /NotAllowedError/); assert.equal(report.denied.landmarkFrames, 0);
    // A created session whose Three binding fails must be ended before retry.
    await page.evaluate(() => { labFixture.reject = false; labFixture.rejectLayer = true; }); await enter();
    await page.waitForFunction(() => xrRoom.status.phase === 'failed');
    report.bindFailure = await page.evaluate(() => xrRoom.status);
    assert.match(report.bindFailure.error, /injected layer failure/);
    assert(report.bindFailure.endObserved && !report.bindFailure.landmarkFrames);

    // Hold this actual File's read, not the renderer or a fake actor: selected
    // PMX, decoder and optional refresh-rate promise cannot gate either eye.
    await page.evaluate(() => {
      labFixture.rejectLayer = false;
      const f = [...document.querySelector('#folder').files].find(f => (f.webkitRelativePath || f.name) === document.querySelector('#pmx').value);
      const read = f.arrayBuffer.bind(f), gate = new Promise(ok => { window.releasePmx = ok; });
      f.arrayBuffer = async () => { window.pmxRead = true; await gate; return read(); };
    });
    for (const reversed of [false, true]) {
      await page.evaluate(rev => { labFixture.reversed = rev; }, reversed);
      await enter();
      await page.waitForFunction(() => (window.labSession?.first && window.pmxRead) || xrRoom.status.error || xrRoom.status.actorError);
      let state = await page.evaluate(() => xrRoom.status);
      assert(!state.error && !state.actorError, JSON.stringify(state));
      const row = { reversed, landmarks: await page.evaluate(() => labSession.first) }; report.sessions.push(row);
      await page.evaluate(() => releasePmx());
      await page.waitForFunction(() => xrRoom.status.actorFrames >= 2 || xrRoom.status.error || xrRoom.status.actorError);
      state = await page.evaluate(() => xrRoom.status); assert(!state.error && !state.actorError, JSON.stringify(state));
      row.actor = await page.evaluate(() => labSession.readNextDraw());
      row.monoControl = await page.evaluate(async()=>{labFixture.sameEye=true;try{return await labSession.readNextDraw();}finally{labFixture.sameEye=false;}});
      assert.equal(row.monoControl.different,0,'Same eye pose must see the same original PMX in both layers');
      await page.waitForFunction(() => xrRoom.status.clothSteps > 3 || xrRoom.status.clothError || xrRoom.status.error);
      assert(!await page.evaluate(()=>xrRoom.status.clothError||xrRoom.status.error),'The selected test PMX did not run the skirt solver');
      if (!reversed && process.env.XR_ROOM_HAND_PLAN) {
        const saved=JSON.parse(await fs.readFile(process.env.XR_ROOM_HAND_PLAN,'utf8')), {sites}=saved.plan??saved;
        assert.equal(sites.length,2);
        const {evidence,images,lift}=await page.evaluate(require('./xr-cloth-take.cjs'),{sites:sites.map(({start,end,spot,radial,marks,mat})=>({start,end,spot,radial,marks,mat}))});
        row.patches=evidence;row.liftMm=lift;
        if (process.env.XR_ROOM_SAVE_HANDS) {
          const out=path.join(root,'local-review/screenshots/three-cloth-hands');await fs.mkdir(out,{recursive:true});
          for(const [id,png] of Object.entries(images))await fs.writeFile(path.join(out,`${id}.png`),Buffer.from(png.split(',')[1],'base64'));
        }
        // Within each actual eye: both hands alter distinct cloth patches;
        // retracting just the left tends to the independent right-only image.
        for(let e=0;e<2;e++){
          const count=(trial,side)=>evidence[trial][e][side].changed;
          for(const [probe,side] of [['bothVsEmpty',0],['bothVsEmpty',1],['leftVsEmpty',0],['rightVsEmpty',1],['bothVsLeft',1],['bothVsRight',0],['withdrawVsEmpty',1]])assert(count(probe,side)>10,`${probe}: eye ${e}, patch ${side}`);
          for(let i=0;i<2;i++)assert(count('released',i)<count('bothVsEmpty',i),`release did not approach empty cloth: eye ${e}, patch ${i}`);
        }
        for(let i=0;i<2;i++){
          const own=i?'right':'left',other=i?'left':'right';
          assert(lift[own].hold[i]>18 && lift.both.hold[i]>18 && lift.both.hold[i]-lift[other].hold[i]>10,`No distinct held patch ${i}`);
          assert(Math.abs(lift.both.withdrawLeft[i]-lift.right.withdrawLeft[i])<14,'Left withdrawal did not approach right-only fabric');
          assert(Math.abs(lift.both.release[i])<12,`Patch ${i} did not drop back to rest`);
        }
        assert(lift.both.withdrawLeft[1]>18 && lift.both.withdrawLeft[0]<lift.both.hold[0]-10,'Wrong side lost support');
      }
      if (process.env.XR_ROOM_VMD && !reversed) {
        const pressA=async()=>{for(const down of [true,false])await page.evaluate(async p=>{labSession.inputSources.find(s=>s.handedness==='right').gamepad.buttons[4].pressed=p;await labSession.readNextDraw();},down);};
        await page.waitForFunction(()=>xrRoom.status.duration>0||xrRoom.status.motionError);
        assert(!await page.evaluate(()=>xrRoom.status.motionError));
        await pressA();await page.waitForFunction(()=>xrRoom.status.time>.35);await pressA();
        const held=await page.evaluate(()=>({...xrRoom.status}));await page.waitForFunction(n=>xrRoom.status.clothSteps>n+8,held.clothSteps);
        assert.equal(await page.evaluate(()=>xrRoom.status.time),held.time);
        await pressA();await page.waitForFunction(t=>xrRoom.status.time>t+.2,held.time);await pressA();row.heldVmd=held.time;
      }
      row.stats = await page.evaluate(() => labSession.stats);
      if (reversed) await page.evaluate(() => labSession.end()); else await page.locator('#exit').click();
      await page.waitForFunction(() => !document.querySelector('#enter').disabled);
      row.exit = await page.evaluate(() => xrRoom.status);
      assert.equal(row.exit.phase, 'ended', JSON.stringify(row.exit)); assert(row.exit.endObserved);
      if (!process.env.XR_ROOM_VMD) assert.equal(row.exit.evaluations, 1);
      assert(row.exit.clothSteps>0); assert.equal(row.exit.rate72, 'pending');
      assert.equal(row.stats.maxPending, 1); assert.equal(row.stats.layers, 1);
      assert.deepEqual(row.stats.references, ['local-floor']);
      const { left, right } = row.stats.slices;
      assert.equal(left, Number(reversed)); assert.equal(right, Number(!reversed));
      const { postX, different } = row.landmarks;
      assert(postX.flat().every(Number.isFinite) && different > 100, `Missing stereo landmarks: ${JSON.stringify(row.landmarks)}`);
      assert(row.actor.postX.flat().every(Number.isFinite) && row.actor.changed.every(n => n > 250 && n < 240*240*.7),
        `Missing actor difference or landmarks: ${JSON.stringify(row.actor)}`);
      row.nearFarDisparity = [0, 1].map(i => postX[left][i] - postX[right][i]);
      assert(row.nearFarDisparity[0] > row.nearFarDisparity[1] + 1 && row.nearFarDisparity[1] > 1,
        `r187 output does not match the binding's ${reversed ? 'reversed' : 'ordinary'} eye slices: ${JSON.stringify(row.nearFarDisparity)}`);
    }
    assert.deepEqual(errors, []);
  } finally {
    if (page) {
      report.last = await page.evaluate(() => window.xrRoom?.status).catch(() => null);
      report.adapters = await page.evaluate(() => window.labFixture?.adapters).catch(() => null);
    }
    report.errors = errors; console.log(JSON.stringify(report, null, 2));
    await browser?.close(); await server?.close(); if (generated) await fs.rm(generated, { recursive: true, force: true });
  }
  assert(report.adapters?.length && report.adapters.every(a => a.xrCompatible && a.vendor && !a.fallback && !/swiftshader|warp|llvmpipe|software/i.test(JSON.stringify(a))), 'No verified XR-compatible hardware adapter');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
