// From the repository root, with Edge and playwright-core available:
//   node scripts/webgpu-actor/cloth-proof-smoke.cjs
//   node scripts/webgpu-actor/cloth-proof-smoke.cjs "path/to/actor.pmx" ["path/to/pose.vpd|motion.vmd" [seconds]]
// Set PLAYWRIGHT_CORE to an installed playwright-core if it is not on the module
// path. For an existing local Vite dev server set CLOTH_PROOF_URL to its origin.
// Manual entry: http://localhost:5173/scripts/webgpu-actor/probe.html?cloth-proof
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const temp = path.join(os.tmpdir(), 'opencode');
function playwright() {
  if (process.env.PLAYWRIGHT_CORE) return require(process.env.PLAYWRIGHT_CORE);
  try { return require('playwright-core'); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
  return require(path.join(process.env.XR_SMOKE_DIR || path.join(temp, 'xr-browser-smoke'), 'node_modules/playwright-core'));
}

async function main() {
  const [input, animation, rawTime = '0', ...extra] = process.argv.slice(2);
  if (input === '--help' || input === '-h') {
    console.log('node scripts/webgpu-actor/cloth-proof-smoke.cjs [local.pmx [local.vmd|local.vpd [seconds]]]'); return;
  }
  const pmx = input && path.resolve(input), clip = animation && path.resolve(animation), seconds = Number(rawTime);
  assert(!extra.length && Number.isFinite(seconds) && seconds >= 0, 'Expected [PMX [VMD/VPD [seconds]]]');
  if (pmx) { assert(/\.pmx$/i.test(pmx), 'Expected a local PMX file'); assert((await fs.stat(pmx)).isFile()); }
  if (clip) { assert(/\.(vmd|vpd)$/i.test(clip), 'Expected a local VMD or VPD file'); assert((await fs.stat(clip)).isFile()); }
  const { chromium } = playwright(); let server, browser;
  try {
    let origin = process.env.CLOTH_PROOF_URL;
    if (!origin) {
      const { createServer } = await import('vite');
      server = await createServer({ root, configFile: false, logLevel: 'error', cacheDir: path.join(temp, 'vite-cloth-proof-r187'),
        resolve: { dedupe: ['three'] }, optimizeDeps: { entries: ['scripts/webgpu-actor/probe.html'] },
        server: { host: '127.0.0.1', port: 0, fs: { deny: ['.env', '.env.*', '*.{pem,crt}', '**/.git/**', '**/sample/**', '**/local-review/**', '**/.openchamber/**'] } } });
      await server.listen(); origin = server.resolvedUrls.local[0];
    }
    const url = new URL('/scripts/webgpu-actor/probe.html?cloth-proof', origin);
    assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Use a loopback Vite dev server for local files');
    browser = await chromium.launch({ channel: process.env.CHANNEL || 'msedge', headless: true, args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] });
    const page = await browser.newPage(), errors = []; page.setDefaultTimeout(60000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') console.error(m.text()); });
    await page.goto(url.href); await page.waitForFunction(() => typeof window.runClothProof === 'function');
    if (pmx) {
      const dir = path.dirname(pmx), name = path.basename(pmx);
      await page.locator('#folder').setInputFiles(dir);
      const value = await page.locator('#pmx option').evaluateAll((opts, [dirName, name]) => {
        const values = opts.map(o => o.value); return values.find(v => v === `${dirName}/${name}` || v === name);
      }, [path.basename(dir), name]);
      assert(value, 'Named PMX missing from selected directory'); await page.locator('#pmx').selectOption(value);
      if (clip) await page.locator('#motion').setInputFiles(clip);
      await page.locator('#time').fill(String(seconds));
    }
    await page.locator('#clothProof').click();
    await page.waitForFunction(() => !document.getElementById('controls').disabled, null, { timeout: 240000 });
    const json = await page.locator('#summary').textContent();
    assert(json, await page.locator('#status').textContent()); const report = JSON.parse(json);
    assert.equal(report.mounts.length, 2); assert(report.mounts.every(m => m.movedVsOracle.ok));
    assert.equal(report.model.startsWith('generated'), !pmx);
    assert.equal(report.pose, !clip ? 'standing' : /\.vpd$/i.test(clip) ? 'VPD' : 'VMD');
    assert.deepEqual(errors, []); console.log(JSON.stringify(report, null, 2));
  } finally { try { await browser?.close(); } finally { await server?.close(); } }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
