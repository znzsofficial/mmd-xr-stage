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
    if (!url) {
      const { createServer } = await import('vite');
      server = await createServer({ root, configFile: false, logLevel: 'error', cacheDir: path.join(temp, 'vite-xr-room-r187'),
        resolve: { dedupe: ['three'] }, optimizeDeps: { entries: ['scripts/webgpu-actor/xr-room.html'] },
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
      row.stats = await page.evaluate(() => labSession.stats);
      if (reversed) await page.evaluate(() => labSession.end()); else await page.locator('#exit').click();
      await page.waitForFunction(() => !document.querySelector('#enter').disabled);
      row.exit = await page.evaluate(() => xrRoom.status);
      assert.equal(row.exit.phase, 'ended', JSON.stringify(row.exit)); assert(row.exit.endObserved);
      assert.equal(row.exit.evaluations, 1); assert.equal(row.exit.rate72, 'pending');
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
