// Compare the *final* stereo images at a held dance pose. Controls and the
// clock below are the real game components, never injected store commands.
const assert=require('node:assert/strict');
module.exports=async function({page,ids,click,until,bButton,frames,target,pickMounted,idleRay,basic=false}){
  const actor=await until('eligible PMX placed on floor',s=>s.ready&&s.selected&&s.actor?.evaluations>1);
  // VMD pause alone does not freeze native hair or GPU cloth. Use the real
  // character setting for the pixel controls, before binding the dance.
  if(actor.physics){
    await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
    await until('still surface for style comparison',s=>s.ready&&!s.physics&&s.actor.mode==='none');await click('hudBack');
    await target({name:'watch:quiet'});await pickMounted(ids.model);
  }
  await click('hudChangeMotion');await click('hudApplyBody');
  await until('dance bound to actor',(s,id)=>s.ready&&s.runtimeId===id&&s.hasBinding&&s.playing&&s.time>.12,actor.runtimeId);
  await bButton();await click('settingsMmdVrPause');const paused=await until('paused dance frame',s=>s.ready&&!s.playing&&s.time>0&&s.actor.poseSeconds===s.time);
  async function quiet(){await target({name:'watch:quiet'});await idleRay();await frames(3);}
  async function pick(key){await pickMounted(ids.model);await click(key);await frames(3);await click('hudDone');await quiet();}
  async function eyes(key){await page.evaluate(async key=>{
    const cfg=window.labFixture,s=window.labSession;if(cfg.take)throw Error('Overlapping eye capture');
    const out=await new Promise((ok,no)=>{const timer=setTimeout(()=>{cfg.take=null;no(Error('No stereo submission'));},8000);
      cfg.take={eyeY:1.45,eyeZ:0,time:0,inputs(){this.time=performance.now();},afterDraw(){clearTimeout(timer);cfg.take=null;ok(s.copyEyes());}};});
    (cfg.styleEyes??={})[key]=out;
  },key);}
  await quiet();await eyes('base');await pick('actorStyleEndfield');
  const style=await until('selected grade installed in a tracked frame',(s,basic)=>s.actor?.style?.mode==='endfield'&&(basic?s.actor.style.clothMaps===0&&s.actor.style.faceMaps===0:s.actor.style.clothMaps>0&&s.actor.style.faceMaps>0),basic,45000);
  await frames(4);await eyes('on');
  // Demand more than the pointer or the HUD changing. Both final layer pairs
  // are sampled with the sheet dismissed, in the central actor region.
  async function diff(a,b){return page.evaluate(([a,b])=>labFixture.styleEyes[a].map((img,i)=>{const other=labFixture.styleEyes[b][i];let changed=0,l1=0;
    for(let y=40;y<205;y++)for(let x=65;x<175;x++){const k=4*(y*img.width+x);let peak=0;for(let c=0;c<3;c++){const d=Math.abs(img.data[k+c]-other.data[k+c]);peak=Math.max(peak,d);l1+=d;}if(peak>6)changed++;}return {changed,l1};}),[a,b]);}
  let change=await diff('base','on');
  for(let i=0;i<30 && change.some(x=>x.changed<100);i++){await frames(8);await eyes('on');change=await diff('base','on');}
  assert(change.every(x=>x.changed>=100),`Style did not reach both actor images: ${JSON.stringify(change)}`);
  await pick('actorStyleMmd');await until('ungraded actor restored',s=>s.actor?.style?.mode==='mmd');await frames(8);await eyes('off');const restore=await diff('base','off');
  assert(restore.every((x,i)=>x.l1<change[i].l1*.35),`Switching back did not restore actor pixels: ${JSON.stringify({restore,change})}`);
  if(basic){
    assert(restore.every(x=>x.l1===0),'Held, physics-off original MMD did not restore pixel-exactly');
    const png=await page.evaluate(()=>{const {base,on}=labFixture.styleEyes,c=document.createElement('canvas');c.width=base[0].width*2;c.height=base[0].height;const ctx=c.getContext('2d');ctx.putImageData(base[0],0,0);ctx.putImageData(on[0],base[0].width,0);return c.toDataURL('image/png').split(',')[1];});
    const fs=require('node:fs/promises'),p=require('node:path'),dir=p.join(__dirname,'../../local-review/screenshots/basic-style-stage');await fs.mkdir(dir,{recursive:true});await fs.writeFile(p.join(dir,'mmd-and-basic.png'),Buffer.from(png,'base64'));
  }
  await until('same paused evaluator after A/B',(s,p)=>s.runtimeId===p.id&&s.actor.poseSeconds===p.time&&s.time===p.time&&s.hasBinding&&!s.playing,{id:actor.runtimeId,time:paused.time});
  await bButton();await click('settingsMmdVrPlay');await until('paused VMD resumed',(s,t)=>s.playing&&s.time>t+.05,paused.time);
  await pickMounted(ids.model);await click('actorStyleEndfield');
  const running=await until('live style change kept the same performance',(s,p)=>s.ready&&s.playing&&s.runtimeId===p.id&&s.hasBinding&&s.actor.style?.mode==='endfield'&&s.time>p.time&&s.actor.poseSeconds>p.time,{id:actor.runtimeId,time:paused.time+.12});
  await bButton();await click('settingsVrDesktopExit',{retiring:true});await until('room retired',s=>s.phase==='ended'&&!s.overlay&&!s.live);
  const adapters=await page.evaluate(()=>labFixture.adapters);assert(adapters.some(a=>a.xrCompatible)&&adapters.every(a=>a.vendor&&!a.fallback&&!/swiftshader|warp|software/i.test(JSON.stringify(a))));
  return {changedEyes:change,restoredEyes:restore,pausedTime:paused.time,resumedTime:running.time,sameRuntime:true,slots:style.actor.style.slots,faceMaps:style.actor.style.faceMaps,clothMaps:style.actor.style.clothMaps};
};
