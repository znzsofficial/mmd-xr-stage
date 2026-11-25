// Run once on the tested dist. XR_SMOKE_DIR contains iwer.js and node_modules/playwright-core.
// One GPU, one headset session: walk while the native chunk is held, then release it and repeat.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),assert=require('node:assert/strict');
const base=process.env.XR_SMOKE_DIR||path.join(os.tmpdir(),'opencode/xr-browser-smoke');
const {chromium}=require(path.join(base,'node_modules/playwright-core'));
const comfort=process.argv.includes('--comfort'),root=path.resolve(process.env.QA_PLANET_DIST||'dist'),out=path.resolve(process.env.QA_PLANET_OUT||('local-review/verification/'+(comfort?'normal-walk':'home-walk')));
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),f=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!f.startsWith(root+path.sep)||!fs.statSync(f,{throwIfNoEntry:false})?.isFile())return res.writeHead(404).end();
  res.setHeader('content-type',({'.wasm':'application/wasm','.js':'text/javascript','.html':'text/html','.css':'text/css','.json':'application/json','.webp':'image/webp'})[path.extname(f)]??'application/octet-stream');fs.createReadStream(f).pipe(res);
});
function install(){
  localStorage.setItem('neko-virt-os.mmd-vr-showcase.v2',JSON.stringify({renderQuality:'low',shadowsPref:'off',framebufferScalePref:'0.7',walkSpeedPref:'normal',normalEyeOffset:0}));
  const d=window.device=new IWER.XRDevice(IWER.metaQuest3,{stereoEnabled:true});d.installRuntime({forceInstall:true,polyfillLayers:false});d.position.set(0,1.63,0);
  const qa=window.walkQA={rows:[],record:false,serial:0},get=navigator.xr.requestSession.bind(navigator.xr),stamp=new WeakMap();
  navigator.xr.requestSession=async(...args)=>{const s=qa.session=await get(...args),raf=s.requestAnimationFrame.bind(s);s.requestAnimationFrame=cb=>raf((t,f)=>{stamp.set(f,t);cb(t,f)});return s;};
  window.__THREE_DEVTOOLS__=new EventTarget();window.__THREE_DEVTOOLS__.addEventListener('observe',({detail:r})=>{
    if(!r.isWebGLRenderer)return;const render=r.render;r.render=function(scene,...args){const result=render.call(this,scene,...args);
       if(!r.xr.isPresenting||!scene.isScene||!(scene===qa.scene||scene.getObjectByName('wind:map:salt:home')))return result;
      const f=r.xr.getFrame(),pose=f.getViewerPose(r.xr.getReferenceSpace()),views=r.xr.getCamera().cameras,t=stamp.get(f);
      if(!pose||views.length!==2||!Number.isFinite(t)||qa.t===t)return result;
      qa.scene=scene;qa.serial++;qa.t=t;qa.camera=views[0];qa.trackedEye=pose.views[0].transform.position;
      if(qa.record){const source=Array.from(qa.session.inputSources).find(s=>s.handedness==='left'&&s.gamepad),eyes=views.map(c=>c.position.clone().setFromMatrixPosition(c.matrixWorld));
        // Stereo children have runtime-supplied world matrices. getWorld*
        // recomputes those as tracking-local on an unparented eye camera.
        const dir=views[0].quaternion.clone().setFromRotationMatrix(views[0].matrixWorld).normalize(),up=eyes[0].clone().set(0,1,0).applyQuaternion(dir);
         const head=pose.transform.orientation,base=dir.clone().multiply(dir.clone().set(head.x,head.y,head.z,head.w).invert()),baseUp=up.clone().set(0,1,0).applyQuaternion(base);
         const mid=eyes[0].clone().lerp(eyes[1],.5),sole=mid.clone().addScaledVector(baseUp,-pose.transform.position.y);
         qa.rows.push({t,axis:source?.gamepad.axes[2],foot:sole.toArray(),eye:mid.toArray(),tracked:pose.transform.position.y,baseUp:baseUp.toArray(),ipd:eyes[0].distanceTo(eyes[1]),q:dir.toArray(),rightQ:dir.clone().setFromRotationMatrix(views[1].matrixWorld).normalize().toArray()});}
      return result;};});
  qa.wait=async ms=>{const start=qa.t;let timer;const pumping=async()=>{do{await new Promise(r=>qa.session.requestAnimationFrame(r))}while(qa.t-start<ms);};
    try{await Promise.race([pumping(),new Promise((_,fail)=>{timer=setTimeout(()=>fail(Error('no stereo draw during XR trial')),ms+6000)})])}finally{clearTimeout(timer)}};
  qa.pulse=async axis=>{qa.rows=[];qa.record=true;try{await qa.wait(120);d.controllers.left.updateAxes('thumbstick',axis,0);await qa.wait(1320);
    d.controllers.left.updateAxes('thumbstick',0,0);await qa.wait(500);return qa.rows;}finally{qa.record=false;d.controllers.left.updateAxes('thumbstick',0,0);}};
}
function measure(rows,raw){
  const first=rows.findIndex(r=>Math.abs(r.axis-raw)<1e-5),end=rows.findIndex((r,i)=>i>first&&Math.abs(r.axis)<.01);
  assert(first>0&&end>first+1,'missing native drive/release');const start=rows[first-1].t;let m=0,signed=0,sim=0,wall=0,drift=0;
  for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i],dt=(b.t-a.t)/1000,dist=Math.hypot(...b.foot.map((x,j)=>x-a.foot[j]));
    assert(dt>0&&b.ipd>.04&&b.ipd<.085,'invalid stereo sample');assert(Math.abs(b.q.reduce((v,x,j)=>v+x*b.rightQ[j],0))>.99999,'eyes disagree');
    if(i>=end){drift+=dist;continue}if(i<first)continue;
    assert(Math.abs(b.axis-raw)<1e-5,'axis changed during hold');const duration=Math.max(0,Math.min((b.t-start)/1000,1.25)-Math.max((a.t-start)/1000,.55));
    const [x,y,z,w]=a.q,right=[1-2*(y*y+z*z),2*(x*y+w*z),2*(x*z-w*y)];
    signed+=right.reduce((v,n,j)=>v+n*(b.foot[j]-a.foot[j]),0)*Math.sign(raw)*duration/dt;
    m+=dist*duration/dt;sim+=Math.min(.05,dt)*duration/dt;wall+=duration;
  }
  assert(wall>.69&&sim/wall>.88,'inconclusive: inadequate XR clock coverage');const speed=m/wall,target=2.4*(Math.abs(raw)-.16)/.84;
  assert(speed>target*.83&&speed<target*1.15,`axis ${raw}: steady ${speed} m/s; expected near ${target}`);
  assert(signed>.9*m,'travel did not follow the native stick direction');assert(drift<.002,`release drift ${drift}m`);return {axis:raw,steadyMps:speed,wall,sim,drift};
}
let browser,release;const gate=new Promise(r=>release=r);
async function normalRoute(page){
  const traces=await page.evaluate(async()=>{const q=walkQA,l=device.controllers.left,r=device.controllers.right,res={};
    const segment=async(key,fn)=>{q.rows=[];q.record=true;try{await fn();res[key]=q.rows;}finally{q.record=false;}};
    const axis=(x,y)=>l.updateAxes('thumbstick',x,y),turn=async x=>{r.updateAxes('thumbstick',x,0);await q.wait(140);r.updateAxes('thumbstick',0,0);await q.wait(140);};
    await q.wait(900);await segment('start',()=>q.wait(360));
    await segment('walk',async()=>{axis(0,-1);await q.wait(4100);device.quaternion.set(0,0,Math.sin(.14),Math.cos(.14));await q.wait(2200);device.quaternion.set(0,0,0,1);await q.wait(1100);axis(0,0);await q.wait(240);});
    await segment('turn',async()=>{await turn(1);await turn(-1);});
    await segment('hop',async()=>{axis(0,-1);r.updateButtonValue('a-button',1);await q.wait(180);r.updateButtonValue('a-button',0);await q.wait(2200);axis(0,0);await q.wait(1000);});
    await segment('resume',async()=>{axis(0,-1);await q.wait(1400);axis(0,0);await q.wait(300);});return res;});
  const {Vector3}=require('three');require('node:module').registerHooks({resolve(s,c,next){return next(c.parentURL?.includes('/src/')&&s.startsWith('.')&&!path.extname(s)?s+'.ts':s,c);}});
  const {altitude,homeWorld}=require('../src/mmdVrShowcase/movement/orbitalSurfaces.ts');const summary={};
  for(const [key,rows] of Object.entries(traces)){assert(rows.length>=4&&rows.every(r=>r.ipd>.04&&r.ipd<.085&&Math.abs(r.q.reduce((n,v,j)=>n+v*r.rightQ[j],0))>.99999));
    const data=rows.map(row=>{const eye=new Vector3(...row.eye),radial=eye.clone().sub(homeWorld.centre).normalize(),up=new Vector3(...row.baseUp);
      return {tilt:up.angleTo(radial)*180/Math.PI,height:altitude(homeWorld,eye),tracked:row.tracked};});
    const pathM=rows.reduce((sum,r,i)=>i?sum+Math.hypot(...r.foot.map((v,j)=>v-rows[i-1].foot[j])):sum,0);
    summary[key]={frames:rows.length,pathM,first:data[0],last:data.at(-1),maxTilt:Math.max(...data.map(s=>s.tilt)),maxHeight:Math.max(...data.map(s=>s.height))};
  }
  fs.writeFileSync(path.join(out,'comfort-summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
  assert(summary.walk.pathM>8&&summary.resume.pathM>.8,'route blocked; not sufficient to establish post-landing walking');
  assert(summary.hop.maxHeight>summary.turn.last.height+.05,'A did not produce measurable lift');
  if(!process.env.QA_OBSERVE_BASELINE){assert(summary.resume.last.tilt<1,'did not resume upright walking without Y');assert(Math.abs(summary.resume.last.height-summary.resume.last.tracked)<.06,'resting eyes no longer track height above the rendered shell');}
}
(async()=>{
  fs.accessSync(path.join(root,'index.html'));fs.mkdirSync(out,{recursive:true});await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-proxy-server','--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--disable-background-timer-throttling']});
  const page=await browser.newPage({locale:'zh-CN',viewport:{width:900,height:580}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(40000);
   let held=0;if(!comfort)await page.route('**/assets/planet-physics-*.js',async r=>{held++;await gate;await r.continue();});
  await page.addInitScript({content:fs.readFileSync(path.join(base,'iwer.js'),'utf8')+'\n('+install.toString()+')()'});
   await page.goto(new URL('/?set=glassPlanet',process.env.QA_PLANET_ORIGIN||'http://127.0.0.1:'+server.address().port).href);await page.locator('.stage-first-room select').selectOption('glassPlanet');await page.locator('.stage-launch-row .stage-btn-primary').first().click();
   await page.waitForFunction(()=>walkQA.serial>8&&walkQA.session.inputSources.length>=2);if(!comfort)assert(held,'WASM chunk was not intercepted');
   await page.evaluate(async()=>{const q=walkQA,hand=device.controllers.right;if(q.scene.getObjectByName('wind:map:salt:home').pointerEvents==='auto')return;
    const press=async key=>{hand.updateButtonValue(key,1);await q.wait(80);hand.updateButtonValue(key,0);await q.wait(80)};
    if(!q.scene.getObjectByName('hud:返回观看'))await press('b-button');const button=q.scene.getObjectByName('hud:返回观看');if(!button)throw Error('missing close-menu target');
    const c=q.camera,at=button.getWorldPosition(c.position.clone());
    // Both eyes have the navigation origin as their world transform prefix;
    // remove it to aim in tracked coordinates, compensating for the left eye.
    const eye=c.position.clone().setFromMatrixPosition(c.matrixWorld),rot=c.quaternion.clone().setFromRotationMatrix(c.matrixWorld).normalize();
    const v=at.sub(eye).applyQuaternion(rot.invert()),p=q.trackedEye;
    v.add(c.position.clone().set(p.x-hand.position.x,p.y-hand.position.y,p.z-hand.position.z)).normalize();
    const aim=c.quaternion.clone().setFromUnitVectors(c.position.clone().set(0,0,-1),v);hand.quaternion.set(aim.x,aim.y,aim.z,aim.w);await q.wait(60);await press('trigger');});
   await page.waitForFunction(()=>walkQA.scene.getObjectByName('wind:map:salt:home').pointerEvents==='auto');
   if(comfort){await normalRoute(page);await page.evaluate(async()=>{await walkQA.wait(1100);await walkQA.session.end();});const dl=page.waitForEvent('download');await page.getByRole('button',{name:'导出上次 VR 性能记录（JSON）',exact:true}).click();const report=path.join(out,'export.json');await(await dl).saveAs(report);const end=JSON.parse(fs.readFileSync(report)).windows.at(-1).planetMovement;
     assert.equal(end.backend,'rapier');assert(end.snapTurns===2&&(end.alignments??0)===0);if(!process.env.QA_OBSERVE_BASELINE)assert(end.grounded);assert.deepEqual(errors,[]);console.log(end);return;}
  const stats={};for(const backend of ['pending','rapier']){
    if(backend==='rapier'){
      // Hold still across the actual import and instantiation; neither eye may
      // adopt the capsule spawn. The prior phase ends on the flank, not spawn.
      await page.evaluate(async()=>{walkQA.rows=[];walkQA.record=true;await walkQA.wait(180)});const response=page.waitForResponse(r=>/\/planet-physics-[^/]+\.js$/.test(r.url()));release();await response;
      const rows=await page.evaluate(async()=>{await walkQA.wait(2500);walkQA.record=false;return walkQA.rows});const a=rows[0];
      assert(rows.length>=5&&rows.every(b=>Math.hypot(...b.foot.map((v,j)=>v-a.foot[j]))<.002&&Math.abs(b.q.reduce((v,x,j)=>v+x*a.q[j],0))>.999999),'view moved during late seed');
      fs.writeFileSync(path.join(out,'late-seed.json'),JSON.stringify(rows));
    }
    for(const raw of [.25,1]){const axis=raw*(backend==='rapier'?-1:1),rows=await page.evaluate(axis=>walkQA.pulse(axis),axis);
      fs.writeFileSync(path.join(out,backend+'-'+raw+'.json'),JSON.stringify(rows));stats[backend+'-'+raw]=measure(rows,axis);}
  }
  await page.evaluate(async()=>{await walkQA.wait(1200);await walkQA.session.end()});const dl=page.waitForEvent('download');await page.getByRole('button',{name:'导出上次 VR 性能记录（JSON）',exact:true}).click();
  const report=path.join(out,'export.json');await(await dl).saveAs(report);const windows=JSON.parse(fs.readFileSync(report)).windows.map(w=>w.planetMovement).filter(Boolean);
  assert(windows.some(w=>w.backend==='pending'&&w.walkInputFrames>0));assert(windows.at(-1)?.backend==='rapier'&&windows.at(-1)?.grounded);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(stats,null,2));console.table(stats);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{release();await browser?.close();server.close()});
