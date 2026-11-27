// node scripts/webgpu-actor/mixed-layout.mjs [--screen-only [--dist]]
// Player controls drive the product. Observers only project points, measure the
// real displayed pixels and compare mounted transforms against the saved take.
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createServer,preview} from 'vite';
import {signs,writeSigns} from './layout-signs.mjs';
import {cast,writeCast} from './layout-cast.mjs';
import {layoutPixels} from './layout-pixels.mjs';
import {runMixedTake, observeLayout} from './mixed-take.mjs';

const require=createRequire(import.meta.url), temp=join(tmpdir(),'opencode');
const {chromium}=require(process.env.PLAYWRIGHT_CORE || join(process.env.XR_SMOKE_DIR || join(temp,'xr-browser-smoke'),'node_modules/playwright-core'));
const output=resolve('local-review/screenshots/mixed-layout');
const screenOnly=process.argv.includes('--screen-only');
const built=process.argv.includes('--dist');
assert(!built||screenOnly,'--dist requires --screen-only (the mixed take observes the dev graph)');

function observeScreen() {
  window.__THREE_DEVTOOLS__=new EventTarget();
  window.__THREE_DEVTOOLS__.addEventListener('observe',({detail:r})=>{
    if(!r.isWebGLRenderer)return;
    const render=r.render;
    r.render=function(scene,camera,...args){
      const result=render.call(this,scene,camera,...args);
      if(!scene.isScene||!r.domElement.closest('.screen-picture'))return result;
      const canvas=r.domElement, rect=canvas.getBoundingClientRect();
      const project=v=>v.project(camera), vector=(...p)=>camera.position.clone().set(...p);
      window.screenGround=(x,z)=>{const v=project(vector(x,.012,z));return [rect.left+(1+v.x)*rect.width/2,rect.top+(1-v.y)*rect.height/2];};
      const request=window.screenSample;
      if(!request)return result;
      window.screenSample=null;
      const gl=r.getContext();
      const at=(u,v)=>{const rgba=new Uint8Array(4);gl.readPixels(Math.floor(u*canvas.width),Math.floor((1-v)*canvas.height),1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);return [...rgba].slice(0,3);};
      try{request.done(layoutPixels(scene,camera,at,request));}catch(e){request.fail(e);}return result;
    };
  });
}

function verifyPaint(read,names){
  assert.deepEqual(read.map(s=>s.name).sort(),[...names].sort());
  for(const {name,background,ink} of read){
    const {channel}=signs.find(s=>s.name===name);
    assert(background[channel]>Math.max(...background.filter((_,i)=>i!==channel))+45,`${name} wrong sign paint: ${background}`);
    assert(Math.min(...ink)>Math.min(...background)+55,`${name} missing white symbol: ${ink} / ${background}`);
  }
}

const folder=await mkdtemp(join(temp,'stage-layout-'));
let browser,server,page;
const errors=[];
try{
  await writeSigns(folder);if(!screenOnly)await writeCast(folder);await mkdir(output,{recursive:true});
  if(built)server=await preview({logLevel:'error',preview:{host:'127.0.0.1',port:0,open:false}});
  else {server=await createServer({logLevel:'error',cacheDir:join(temp,'vite-game-floor-smoke'),optimizeDeps:{include:['three/webgpu','three/tsl','@yohawing/three-mmd-loader/webgpu']},server:{host:'127.0.0.1',port:0,hmr:false}});await server.listen();}
  browser=await chromium.launch({channel:process.env.CHANNEL||'msedge',args:['--enable-gpu','--use-angle=d3d11','--ignore-gpu-blocklist','--disable-background-timer-throttling']});
  page=await browser.newPage({locale:'zh-CN',viewport:{width:1420,height:900}});page.setDefaultTimeout(24000);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript({content:`window.layoutPixels=${layoutPixels}; (${observeScreen})();`});
  if(!screenOnly){const stereo=require('../../experiments/gpu-cloth/stereoShim.cjs'),extend=require('./xr-room-shim.cjs');
    await page.addInitScript({content:`(${stereo})(640);(${extend})();labFixture.controllerProfile='meta-quest-touch-plus';`});}
  await page.goto(server.resolvedUrls.local[0]+(screenOnly?'?set=floor':'?set=lawn&xrBackend=webgpu'));
  await page.locator('.stage-drop-zone input[webkitdirectory]').setInputFiles(folder);await page.locator('.stage-report-stats').waitFor();
  const btn=name=>page.getByRole('button',{name,exact:true});
  const screen=()=>btn('屏幕观看').click(); const exit=()=>page.locator('.screen-back').click();
  const openBag=async()=>{if(!await page.locator('.screen-item').count())await btn('背包').click();};
  const item=name=>page.locator('.screen-item').filter({hasText:name});
  const sheet=name=>page.locator('.screen-actor-sheet h2').filter({hasText:name.split('.')[0]});
  const ground=async (x,z)=>{
    await btn('放在中央').waitFor();await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const [px,py]=await page.evaluate(([x,z])=>screenGround(x,z),[x,z]);await page.mouse.click(px,py);
  };
  const place=async(name,x,z)=>{await openBag();await item(name).click();await ground(x,z);await sheet(name).waitFor();};
  const select=async(name)=>{await openBag();await item(name).click();await sheet(name).waitFor();};
  if(!screenOnly)await page.evaluate(observeLayout);
  const sample=()=>page.evaluate(data=>new Promise((done,fail)=>{window.screenSample={...data,items:window.layoutState?.().items,done,fail};}),{cast,signs});
  async function check(names){const {props}=await sample();verifyPaint(props,names);return props;}
  const all=signs.map(s=>s.name),[red,green,blue]=all;
  if(!screenOnly){
    await runMixedTake({page,btn,screen,exit,place,sample,select,output,verifyPaint});
  }else{
  await screen();await place(red,-1.1,-2.7);await place(green,.05,-2.7);await place(blue,1.05,-2.7);
  await check(all);await select(green);await btn('放大').click();await btn('移动').click();await ground(.2,-2.35);await sheet(green).waitFor();
  const placed=await check(all),moved=placed.find(p=>p.name===green);assert.equal(moved.scale,1.25);assert(Math.abs(moved.position[0]-.2)<.05);
  await page.locator('.screen-picture canvas').screenshot({path:join(output,'webgl-signs.png')});
  await select(blue);await btn('收回背包').click();await item(blue).locator('strong',{hasText:'放置'}).waitFor();
  await check([red,green]);await exit();await screen();await openBag();await item(green).locator('strong',{hasText:'已上场'}).waitFor();
  const restored=await check([red,green]);assert.deepEqual(restored.find(s=>s.name===green).position,moved.position);assert.equal(restored.find(s=>s.name===green).scale,moved.scale);
  await exit();console.log(built?'Built WebGL:':'Dev WebGL:',JSON.stringify({placed,restored}));
  }
  assert.deepEqual(errors.filter(s=>!/favicon.ico/.test(s)),[]);
}catch(error){
  const last=await page?.evaluate(()=>({layout:window.layoutState?.(),step:window.mixedStep,frames:window.labSession?.stats?.frames,events:window.labSession?.stats?.selectEvents?.slice(-3),
    message:[...document.querySelectorAll('.screen-caption,[role="alert"]')].map(o=>o.textContent)})).catch(()=>null);
  console.error('Mixed-layout failure:',JSON.stringify({last,errors}));throw error;
}
finally{await browser?.close();if(built&&server)await new Promise(done=>server.httpServer.close(done));else await server?.close();await rm(folder,{recursive:true,force:true});}
