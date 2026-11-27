// Inspect the actual WebGL screen camera and the final IWER eye transforms.
// Inputs are real DOM clicks and the Touch thumbstick, never room setters.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const smoke=process.env.XR_SMOKE_DIR||path.join(os.tmpdir(),'opencode/xr-browser-smoke'),{chromium}=require(path.join(smoke,'node_modules/playwright-core'));
const dir=path.resolve('local-review/screenshots/seaside-terminus');
function observe(){window.qa={serial:0,errors:[]};window.__THREE_DEVTOOLS__=new EventTarget();
  const cp=WebGL2RenderingContext.prototype,link=cp.linkProgram;cp.linkProgram=function(p){link.call(this,p);if(!this.getProgramParameter(p,this.LINK_STATUS))qa.errors.push(this.getProgramInfoLog(p));};
  window.__THREE_DEVTOOLS__.addEventListener('observe',({detail:r})=>{if(!r.isWebGLRenderer)return;const render=r.render;r.render=function(s,c){const result=render.call(this,s,c);if(!s.isScene||!s.getObjectByName('scenery:seaside-terminus'))return result;
    qa.serial++;qa.scene=s;qa.r=r;qa.c=c;qa.sea=s.getObjectByName('terminus:sea').position.y;
    if(r.xr.isPresenting){const eyes=r.xr.getCamera().cameras;if(eyes.length===2){const v=eyes.map(e=>e.position.clone().setFromMatrixPosition(e.matrixWorld));qa.ipd=v[0].distanceTo(v[1]);qa.eye=v[0].lerp(v[1],.5).toArray();}}return result;};});
  qa.pixel=(p)=>{const rect=qa.r.domElement.getBoundingClientRect(),v=qa.c.position.clone().fromArray(p).project(qa.c);return [rect.x+(.5+.5*v.x)*rect.width,rect.y+(.5-.5*v.y)*rect.height];};
  localStorage.setItem('neko-virt-os.mmd-vr-showcase.v2',JSON.stringify({renderQuality:'balanced',walkSpeedPref:'normal',normalEyeOffset:0,scenery:'seasideTerminus'}));
}
async function run(){const {createServer,preview}=await import('vite'),dev=process.argv.includes('--dev');const server=dev?await createServer({logLevel:'error',server:{host:'127.0.0.1',port:0,hmr:false}}):await preview({configFile:false,build:{outDir:'dist'},preview:{host:'127.0.0.1',port:0}});let browser;
  try{if(dev)await server.listen();await fs.mkdir(dir,{recursive:true});browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-gpu','--no-proxy-server','--ignore-gpu-blocklist','--use-angle=d3d11']});
    const p=await browser.newPage({locale:'zh-CN',viewport:{width:1250,height:810}}),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
    await p.addInitScript({content:(await fs.readFile(path.join(smoke,'iwer.js'),'utf8'))+'\n('+observe+')();window.device=new IWER.XRDevice(IWER.metaQuest3,{stereoEnabled:true});device.installRuntime({forceInstall:true,polyfillLayers:false});device.position.set(0,1.6,0);'});
    await p.goto(server.resolvedUrls.local[0]+'?set=seasideTerminus');const {makeSwatch}=await import('../experiments/gpu-cloth/swatch.js'),file=makeSwatch();
    await p.locator('input[type=file]').nth(1).setInputFiles({name:file.name,mimeType:'application/octet-stream',buffer:Buffer.from(await file.arrayBuffer())});
    await p.locator('.stage-launch-row button').first().click();await p.waitForFunction(()=>qa.serial>8);const canvas=p.locator('.screen-picture canvas'),tour=p.locator('.screen-corner select');
    const two=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const photo=async name=>{await two();await canvas.screenshot({path:path.join(dir,name+'.png')});};
    await photo('entrance');await tour.selectOption('0');await photo('platform');await tour.selectOption('1');await photo('waterline');await tour.selectOption('2');await photo('return');
    await tour.selectOption('3');await two();const dial=await p.evaluate(()=>qa.pixel(qa.scene.getObjectByName('terminus:tide-dial').getWorldPosition(qa.c.position.clone()).toArray()));
    const before=await p.evaluate(()=>qa.sea);await p.mouse.click(...dial);await p.waitForFunction(y=>Math.abs(qa.sea-y)>.36,before,{timeout:5800});
    await tour.selectOption('2');await two();await p.locator('.screen-corner button').first().click();await p.locator('.screen-item').first().click();await two();const pos=[9.65,.012,-11.92];
    const pixel=await p.evaluate(v=>qa.pixel(v),pos);await p.mouse.click(...pixel);await p.waitForFunction(([x,,z])=>{let hit=false;qa.scene.traverse(o=>{if(o.userData.mmdModelId){const v=o.getWorldPosition(o.position.clone());if(Math.abs(v.x-x)<.15&&Math.abs(v.z-z)<.15)hit=true;}});return hit;},pos);
    assert.deepEqual(await p.evaluate(()=>qa.errors),[]);console.log('Screen: active tide dial, WebGL programs linked, far quay ray placed actor');
    await p.locator('.screen-back').click();await p.locator('.stage-launch-row .stage-btn-primary').click();await p.waitForFunction(()=>qa.ipd>.04&&!!qa.eye);
    const walk=async(x,z)=>{const result=await p.evaluate(async([x,z])=>{const l=device.controllers.left,until=performance.now()+14500;let dx=0,dz=0;try{while(performance.now()<until){const [a,,b]=qa.eye;dx=x-a;dz=z-b;const len=Math.hypot(dx,dz);if(len<.13)break;l.updateAxes('thumbstick',dx/len,dz/len);await new Promise(r=>setTimeout(r,22));}}finally{l.updateAxes('thumbstick',0,0);}return {eye:qa.eye.slice(),remaining:Math.hypot(dx,dz),ipd:qa.ipd};},[x,z]);assert(result.remaining<.16,JSON.stringify({wanted:[x,z],...result}));return result.eye;};
    await walk(0,-11.65);await walk(1.8,-12.3);const low=await walk(1.8,-16.85);await walk(14.1,-16.85);const high=await walk(14.1,-11.6);assert(low[1]<high[1]-.36,JSON.stringify({low,high}));
    assert.deepEqual(await p.evaluate(()=>qa.errors),[]);assert.deepEqual(errors,[]);console.log('XR sole heights, lower landing / beacon:',low[1]-1.6,high[1]-1.6);await p.evaluate(()=>qa.r.xr.getSession().end());await p.locator('.stage-launch-row').waitFor();
  }finally{await browser?.close();await server.close();}}
run().catch(e=>{console.error(e);process.exitCode=1;});
