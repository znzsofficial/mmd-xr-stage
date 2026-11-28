// Exercise the tested dist via player controls. No store imports or private PMX.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {dirname,resolve} from 'node:path';
import {readFile} from 'node:fs/promises';
import {preview} from 'vite';
import {makeSwatch} from '../experiments/gpu-cloth/swatch.js';

const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core');
const xr=createRequire(createRequire(require.resolve('@react-three/xr')).resolve('@pmndrs/xr'));
const iwer=resolve(dirname(xr.resolve('iwer')),'../build/iwer.js');
const server=await preview({preview:{host:'127.0.0.1',port:0,open:false}});let browser;
try{
  browser=await chromium.launch({channel:process.env.CHANNEL||'msedge',args:['--no-proxy-server','--enable-gpu','--ignore-gpu-blocklist']});
  const page=await browser.newPage({locale:'zh-CN'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
  function install(){
    const d=new IWER.XRDevice(IWER.metaQuest3,{stereoEnabled:true});d.installRuntime({forceInstall:true,polyfillLayers:false});
    const q=window.entryTrial={deny:true,stereo:0},request=navigator.xr.requestSession.bind(navigator.xr);
    navigator.xr.requestSession=async(...args)=>{if(q.deny)throw new DOMException('Fixture denied XR','NotAllowedError');return q.session=await request(...args);};
    window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener('observe',({detail:r})=>{if(!r.isWebGLRenderer)return;
      const render=r.render;r.render=function(scene,...args){const v=render.call(this,scene,...args);if(scene.isScene&&scene.getObjectByName('scenery:seaside-terminus')&&r.xr.isPresenting&&r.xr.getFrame()?.session===q.session&&r.xr.getCamera().cameras.length===2){
        q.stereo++;q.actorCount=scene.children.filter(o=>o.userData.mmdModelId).length;}return v;};});
  }
  await page.addInitScript({content:await readFile(iwer,'utf8')+'\n('+install.toString()+')()'});
  await page.goto(server.resolvedUrls.local[0]+'?set=classroom');
  const files=['A.pmx','B.pmx'],buffer=Buffer.from(await makeSwatch().arrayBuffer());
  await page.locator('input[type=file]').nth(1).setInputFiles(files.map(name=>({name,mimeType:'application/octet-stream',buffer})));
  const button=name=>page.getByRole('button',{name,exact:true}),screen=()=>button('屏幕观看').click();
  const back=()=>page.locator('.screen-back').click(),room=id=>page.locator('.screen-header select').selectOption(id);
  const openBag=async()=>{if(!await page.locator('.screen-item').count())await button('背包').click();};
  const item=name=>page.locator('.screen-item').filter({hasText:name});
  const place=async name=>{await openBag();await item(name).click();await button('放在中央').click();await page.locator('.screen-actor-sheet h2',{hasText:name.split('.')[0]}).waitFor();};
  async function expectRoom(placed){await openBag();for(const n of files){await item(n).locator('strong',{hasText:placed===n?'已上场':'放置'}).waitFor();}}
  await screen();await place(files[0]);await room('seasideTerminus');await place(files[1]);await back();
  await page.locator('.stage-first-room select').selectOption('classroom');await button('进入空舞台').click();
  await page.waitForFunction(()=>document.body.textContent.includes('Fixture denied XR'));
  await screen();await expectRoom(files[0]);await room('seasideTerminus');await expectRoom(files[1]);await back();
  await page.evaluate(()=>{entryTrial.deny=false;});await button('进入空舞台').click();
  await page.waitForFunction(()=>entryTrial.stereo>=3);assert.equal(await page.evaluate(()=>entryTrial.actorCount),0);
  await page.evaluate(()=>entryTrial.session.end());await page.locator('.xr-stage-overlay').waitFor({state:'detached'});
  await screen();await expectRoom(null);await room('classroom');await expectRoom(null);await back();
  assert.deepEqual(errors,[]);console.log('PASS: two screen layouts survived denied XR; fresh stereo entry cleared both and kept the imported files.');
}finally{await browser?.close();await new Promise(done=>server.httpServer.close(done));}
