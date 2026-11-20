// Optional dev dependencies live outside the product. Supply paths to
// playwright-core and the IWER browser bundle, then run against a built preview.
const {chromium}=require(process.env.PLAYWRIGHT_CORE||'playwright-core');
const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const url=new URL('classroom.html?probe=1',process.env.PREVIEW_URL||'http://127.0.0.1:4286/');
(async()=>{
  const browser=await chromium.launch({channel:process.env.CHANNEL||'msedge',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  try{
    const p=await browser.newPage(),errors=[];p.setDefaultTimeout(60000);
    p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await p.addInitScript({content:readFileSync(process.env.IWER_BUNDLE,'utf8')+`\nwindow.device=new IWER.XRDevice(IWER.metaQuest3,{stereoEnabled:true});device.installRuntime({forceInstall:true,polyfillLayers:false});device.position.set(0,1.65,0);const request=navigator.xr.requestSession.bind(navigator.xr);navigator.xr.requestSession=async(...a)=>window.session=await request(...a);window.ticks=async n=>{while(n--)await new Promise(r=>session.requestAnimationFrame(r))};`});
    await p.goto(url.href);await p.locator('#demo').click();await p.waitForFunction(()=>window.classroomSample?.().bones===5);
    const enter=async()=>{await p.locator('#xr').click();await p.waitForFunction(()=>classroomSample().report?.frames>=5)};
    const exit=async()=>{await p.evaluate(()=>session.end());await p.waitForFunction(()=>!document.querySelector('#save').disabled)};
    await enter();assert.equal(await p.evaluate(()=>classroomSample().report.views),2);
    const sample=await p.evaluate(async()=>{
      const hand=device.controllers.right,button=async k=>{hand.updateButtonValue(k,1);await ticks(3);hand.updateButtonValue(k,0);await ticks(4)};
      await button('a-button');await ticks(6);await button('a-button');
      hand.position.set(.6,.12,-.45);await ticks(6);
      for(let i=1;i<=30;i++){hand.position.set(.6*(1-i/30),.12,-.45);await ticks(1)}const a=classroomSample();
      for(let i=1;i<=60;i++){hand.position.set(0,.12+i*.008,-.45);await ticks(1)}const b=classroomSample();
      for(let i=1;i<=45;i++){hand.position.set(.014*i,.6,-.45);await ticks(1)}await ticks(40);const c=classroomSample();
      const left=device.controllers.left;left.position.set(.25,.9,-.65);left.quaternion.set(-Math.sin(Math.PI/5),0,0,Math.cos(Math.PI/5));await ticks(4);
      left.updateButtonValue('trigger',1);await ticks(4);left.updateButtonValue('trigger',0);await ticks(5);
      return {paused:[a.frame,b.frame,c.frame],height:[a.hem[1],b.hem[1],c.hem[1]],before:a.position,after:classroomSample().position};
    });
    assert(sample.paused[0]>0&&new Set(sample.paused).size===1);assert(sample.height[1]-sample.height[0]>.045&&sample.height[1]-sample.height[2]>.04);assert.notDeepEqual(sample.before,sample.after);
    await p.evaluate(()=>device.controllers.right.updateButtonValue('b-button',1));await p.waitForFunction(()=>!document.querySelector('#save').disabled);
    const download=p.waitForEvent('download');await p.locator('#save').click();const result=JSON.parse(readFileSync(await(await download).path(),'utf8'));
    assert(result.views===2&&result.buckets.playing.frames>0&&result.buckets.paused.frames>0);
    await p.evaluate(()=>device.controllers.right.updateButtonValue('b-button',0));await enter();assert.deepEqual(await p.evaluate(()=>classroomSample().position),sample.after);await exit();assert.deepEqual(errors,[]);console.log('PASS',sample,result.views,'views');
  }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
