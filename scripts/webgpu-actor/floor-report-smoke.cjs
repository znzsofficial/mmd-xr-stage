// Exercise the downloaded JSON of the compiled qualification build. Simulated
// displays; the two actual renderer sessions run successively in the same tab.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const stereo=require('../../experiments/gpu-cloth/stereoShim.cjs'),extend=require('./xr-room-shim.cjs');
async function main(){
  const base=process.env.XR_SMOKE_DIR||path.join(os.tmpdir(),'opencode/xr-browser-smoke');
  const {chromium}=require(path.join(base,'node_modules/playwright-core')),{preview}=await import('vite');
  const server=await preview({configFile:false,build:{outDir:'dist-qualification'},preview:{host:'127.0.0.1',port:0}});let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-proxy-server','--enable-gpu','--ignore-gpu-blocklist','--use-angle=d3d11']});
    const page=await browser.newPage({locale:'zh-CN'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript({content:await fs.readFile(path.join(base,'iwer.js'),'utf8')+`;(()=>{
      const device=new IWER.XRDevice(IWER.metaQuest3,{stereoEnabled:true});device.installRuntime({forceInstall:true,polyfillLayers:false});device.position.set(0,1.65,0);
      const gl=navigator.xr.requestSession.bind(navigator.xr);(${stereo})();(${extend})();labFixture.controllerProfile='meta-quest-touch-plus';
      const gpu=navigator.xr.requestSession.bind(navigator.xr);navigator.xr.requestSession=(mode,init)=>init?.requiredFeatures?.includes('webgpu')?gpu(mode,init).then(s=>{
        s.supportedFrameRates=[80,90,120];s.updateTargetFrameRate=n=>{window.hint={n,submissions:s.stats.submissions};return new Promise(()=>{})};return s;
      }):gl(mode,init).then(s=>(window.glSession=s));
    })();`});
    await page.goto(server.resolvedUrls.local[0]+'?set=floor&xrBackend=webgpu');
    const {makeSwatch}=await import('../../experiments/gpu-cloth/swatch.js'),file=makeSwatch();
    await page.locator('input[type=file]').nth(1).setInputFiles({name:file.name,mimeType:'application/octet-stream',buffer:Buffer.from(await file.arrayBuffer())});
    await page.locator('.stage-btn-primary[data-xr-backend=webgpu]').click();await page.locator('[data-xr-host=webgpu][data-phase=active]').waitFor();
    const first=await page.evaluate(()=>labSession.first);assert(first.light.every(x=>x>100)&&first.different>100);
    const hint=await page.evaluate(()=>window.hint);assert(hint.n>=80 && hint.submissions>0);
    await page.locator('.xr-stage-exit').click();await page.locator('[data-xr-host=webgpu]').waitFor({state:'detached'});
    async function download(){const button=page.locator('[data-performance-export]');const [file]=await Promise.all([page.waitForEvent('download'),button.click()]);return JSON.parse(await fs.readFile(await file.path(),'utf8'));}
    const gpu=await download();assert.equal(gpu.backend,'webgpu');assert.deepEqual(gpu.eyeViewports,[{eye:'left',width:232,height:230},{eye:'right',width:232,height:230}]);
    assert(gpu.reportedRefreshRates[72]>0 && gpu.windows.some(w=>w.width===240 && w.height===240) && gpu.callbackIntervalMs.worst>0);
    await page.locator('[data-floor-renderer]').selectOption('webgl');
    assert((await page.locator('[aria-labelledby=backpack-heading]').innerText()).includes(file.name));
    await page.locator('.stage-launch-row button.stage-btn-secondary[data-xr-backend=webgl]').click();
    await page.waitForFunction(()=>window.glSession?.renderState?.baseLayer && !!document.querySelector('canvas') && !document.querySelector('.xr-stage-hud'));
    await page.evaluate(()=>new Promise(ok=>{let start;const tick=(t,f)=>{start??=t;if(t-start>1300)ok();else f.session.requestAnimationFrame(tick)};glSession.requestAnimationFrame(tick)}));
    await page.evaluate(()=>glSession.end());await page.locator('.xr-stage-overlay').waitFor({state:'detached'});
    const pair=await download();assert.deepEqual(pair.webgpu,gpu);assert.equal(pair.webgl.backend,'webgl');assert(pair.webgl.intervalCount>0 && pair.webgl.eyeViewports.length===2);assert.deepEqual(errors,[]);
    console.log('Same-tab exported WebGPU + WebGL report:',JSON.stringify(Object.fromEntries(Object.entries(pair).map(([k,r])=>[k,{intervals:r.intervalCount,eyes:r.eyeViewports,rates:r.reportedRefreshRates}]))));
  }finally{await browser?.close();await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
