// node scripts/verify-old-tab.mjs <previous sealed dist> [candidate dist]
// Keep a single old page and its local File alive while changing the files
// served by the origin. No cache, reload, store writes or dev-server modules.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
import stereo from '../experiments/gpu-cloth/stereoShim.cjs';
import extendStereo from './webgpu-actor/xr-room-shim.cjs';
import { makeSwatch } from '../experiments/gpu-cloth/swatch.js';

const previous = process.argv[2];
assert(previous, 'Supply the previous sealed dist directory');
const next = path.resolve(process.argv[3] ?? 'dist');
const playwright = process.env.PLAYWRIGHT_CORE ?? path.join(process.env.XR_SMOKE_DIR ?? path.join(os.tmpdir(),'opencode/xr-browser-smoke'),'node_modules/playwright-core');
const { chromium } = createRequire(import.meta.url)(playwright);
const mime = {'.html':'text/html', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.wasm':'application/wasm', '.webp':'image/webp', '.svg':'image/svg+xml'};
let root = path.resolve(previous);
const lateAssets = new Set();
const server = createServer(async (req,res) => {
  const from = root;
  try {
    const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(from, '.' + (pathname === '/' ? '/index.html' : pathname));
    assert(file.startsWith(from+path.sep));
    const content = await readFile(file);
    if (from === next) lateAssets.add(pathname);
    res.writeHead(200, {'content-type':mime[path.extname(file)] ?? 'application/octet-stream','cache-control':'no-store'}).end(content);
  } catch { res.writeHead(404).end(); }
});

function observeRoom() {
  const scenes=[];
  const q=window.oldTab={};
  window.__THREE_DEVTOOLS__=new EventTarget();
  __THREE_DEVTOOLS__.addEventListener('observe',({detail})=>{
    if(detail.isScene)scenes.push(detail);
    if(detail.isWebGPURenderer)q.renderer=detail;
  });
  q.scene=()=>scenes.findLast(s=>s.getObjectByName('planet:crust'));
  q.eye=()=>{
    const eyes=q.renderer.xr.getCamera().cameras;
    return eyes[0].position.clone().setFromMatrixPosition(eyes[0].matrixWorld)
      .lerp(eyes[1].position.clone().setFromMatrixPosition(eyes[1].matrixWorld),.5).toArray();
  };
  // The simulated headset is fixed in reference space. Use an eye's tracked
  // local pose and submitted world matrix to express the target in that space.
  q.aim=point=>{
    const eye=q.renderer.xr.getCamera().cameras[0];
    const referenceFromWorld=eye.matrix.clone().multiply(eye.matrixWorld.clone().invert());
    const target=eye.position.clone().fromArray(point).applyMatrix4(referenceFromWorld).toArray();
    labSession.aimRay('right',target,{x:.17,y:1.95,z:-.42});
  };
}

// Compare final eye pixels with and without the placed PMX, then restore it.
function actorPixels() {
  const actor=oldTab.scene().children.find(o=>o.visible && o.userData.mmdModelId);
  return new Promise((resolve,reject)=>{
    let n=0;const images=[],time=performance.now();
    const timer=setTimeout(()=>{labFixture.take=null;actor.visible=true;reject(Error('No tracked eye pair'));},10000);
    labFixture.take={inputs(){this.time=time;},afterDraw(s){
      if(++n===1){images.push(s.copyEyes());actor.visible=false;}
      if(n===3){images.push(s.copyEyes());actor.visible=true;}
      if(n!==5)return;
      images.push(s.copyEyes());labFixture.take=null;clearTimeout(timer);
      Promise.all(images).then(([on,off,again])=>resolve(on.map((img,eye)=>{
        let pixels=0;
        for(let i=0;i<img.data.length;i+=4){
          const a=img.data,b=off[eye].data,c=again[eye].data;
          const restored=Math.abs(a[i]-c[i])+Math.abs(a[i+1]-c[i+1])+Math.abs(a[i+2]-c[i+2])<=3;
          if(restored && Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>30)pixels++;
        }
        return pixels;
      })),reject);
    }};
  });
}

let browser;
try {
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${server.address().port}/?set=glassPlanet`;
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-gpu','--use-angle=d3d11','--no-proxy-server','--ignore-gpu-blocklist']});
  const page=await browser.newPage({locale:'zh-CN'}),errors=[];
  page.setDefaultTimeout(18000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(!r.ok() && r.status()>=400 && /\.(js|wasm)$/.test(new URL(r.url()).pathname))errors.push(`${r.status()} ${r.url()}`);});
  await page.addInitScript({content:`(${stereo})(320);(${extendStereo})();labFixture.controllerProfile='meta-quest-touch-plus';(${observeRoom})();`});
  await page.goto(url);
  const file=makeSwatch();
  await page.locator('input[type=file]').nth(1).setInputFiles({name:file.name,mimeType:'application/octet-stream',buffer:Buffer.from(await file.arrayBuffer())});
  await page.locator('.stage-report-stats').waitFor();
  const before=await page.evaluate(()=>({time:performance.timeOrigin,entry:document.querySelector('script[type=module]').src,
    loaded:performance.getEntriesByType('resource').map(r=>r.name)}));
  assert(!(await readFile(path.join(next,'index.html'),'utf8')).includes(new URL(before.entry).pathname),
    'Candidate still has the previous JS entry; supply two different product builds');
  const late=/\/(stage-host|PlanetPhysics|rapier)-[^/]+\.js$/;
  assert(!before.loaded.some(url=>late.test(url)),'Expected a cold first visit');
  root=next;
  await page.locator('select[data-floor-renderer]').selectOption('webgpu');
  await page.locator('.stage-btn-primary[data-xr-backend=webgpu]').click();
  await page.locator('[data-xr-host=webgpu][data-phase=active]').waitFor();
  await page.waitForFunction(()=>oldTab.scene() && oldTab.renderer && labSession.stats.submissions>12);
  assert.deepEqual([...lateAssets].filter(p=>late.test(p)).map(p=>p.match(late)[1]).sort(),['PlanetPhysics','rapier','stage-host']);
  async function frames(n=3){const stop=await page.evaluate(n=>labSession.stats.frames+n,n);await page.waitForFunction(k=>labSession.stats.frames>=k,stop);}
  async function click(point){
    await page.evaluate(p=>oldTab.aim(p),point);await frames();
    for(const down of [true,false]){await page.evaluate(d=>labSession.queueSelect('right',d),down);await frames();}
  }
  async function clickNamed(name){
    const pos=await page.waitForFunction(name=>{const o=oldTab.scene().getObjectByName(name);return o?.getWorldPosition(o.position.clone()).toArray();},name);
    await click(await pos.jsonValue());await pos.dispose();
  }
  if(await page.evaluate(()=>!!oldTab.scene().getObjectByName('hud:返回观看')))await clickNamed('hud:返回观看');
  for(const down of [false,true,false]){
    await page.evaluate(d=>Object.assign(labSession.inputSources.find(s=>s.handedness==='right').gamepad.buttons[5],{pressed:d,touched:d,value:+d}),down);
    await frames();
  }
  await clickNamed('hud:背包');await clickNamed('hud:放置');
  await page.waitForFunction(()=>!!oldTab.scene().getObjectByName('backpack:ground'));
  await click([0,.012,0]);
  await page.waitForFunction(()=>oldTab.scene().children.some(o=>o.visible&&o.userData.mmdModelId));
  const pixels=await page.evaluate(actorPixels);assert(pixels.every(n=>n>100),`Missing actor pixels: ${pixels}`);
  const rapier=[...lateAssets].find(p=>p.startsWith('/assets/rapier-'));
  const initial=await page.evaluate(async url=>{
    const {World}=await import(url); // Already loaded by the actual planet; observe its live driver.
    const step=World.prototype.step;oldTab.walkSteps=0;
    World.prototype.step=function(...args){oldTab.walkSteps++;return step.apply(this,args);};
    oldTab.stop=()=>{World.prototype.step=step;labSession.inputSources.find(s=>s.handedness==='left').gamepad.axes[2]=0;};
    labSession.inputSources.find(s=>s.handedness==='left').gamepad.axes[2]=1;
    return oldTab.eye();
  },rapier);
  try {await page.waitForFunction(()=>oldTab.walkSteps>=35);} finally {await page.evaluate(()=>oldTab.stop());}
  const steps=await page.evaluate(()=>oldTab.walkSteps);
  const final=await page.evaluate(()=>oldTab.eye()),travel=Math.hypot(...final.map((v,i)=>v-initial[i]));
  assert(travel>.2,`Stick did not move the displayed eyes (${travel} m)`);
  await page.locator('.xr-stage-exit').click();await page.locator('[data-xr-host=webgpu]').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>performance.timeOrigin),before.time);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({entry:path.basename(before.entry),lateChunks:[...lateAssets].filter(p=>late.test(p)),stereoActorPixels:pixels,rapierSteps:steps,walkMetres:travel},null,2));
} finally {await browser?.close();server.close();}
