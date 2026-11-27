// The production XR menu, stage lights and character all draw into the same
// two projection slices. The test changes the tracked viewpoint for photos.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');

module.exports=async function({page,ids,click,until,bButton,frames,target,pickMounted,idleRay,room}){
  const actor=await until('portrait actor ready',s=>s.ready&&s.selected&&s.actor?.evaluations>1);
  const quiet=async()=>{await target({name:'watch:quiet'});await idleRay();await frames(3);};
  if(actor.physics){
    await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
    await until('unmoving portrait surface',s=>s.ready&&!s.physics&&s.actor.mode==='none');await click('hudBack');await quiet();
  }else{await click('hudDone');await quiet();}
  async function lighting(key){await bButton();await click('hudMore');await click('settingsEnvironment');await click(key);await click('hudBack');await quiet();}
  async function style(choice){await pickMounted(ids.model);await click(choice==='mmd'?'actorStyleMmd':'actorStyleEndfield');
    await until('material graph committed',(s,choice)=>s.actor?.style?.mode===choice,choice,45000);
    await click('hudDone');await quiet();}
  async function capture(name){await page.evaluate(name=>new Promise((resolve,reject)=>{
    const cfg=window.labFixture;let remaining=4;
    const timer=setTimeout(()=>{cfg.take=null;reject(Error('Missing rendered portrait'));},6000);
    cfg.take={eyeY:1.31,eyeZ:-.97,inputs(){this.time=performance.now();},afterDraw(s){if(--remaining>0)return;
      cfg.take=null;clearTimeout(timer);s.copyEyes().then(p=>{(cfg.portraits??={})[name]=p;resolve();},reject);}};
  }),name);await frames(3);}
  await lighting('settingsMmdVrLightDaylight');await capture('mmd');await style('endfield');await capture('day');
  await lighting('settingsMmdVrLightWarm');await capture('warm');await lighting('settingsMmdVrLightDaylight');await capture('dayAgain');
  await style('mmd');await capture('restored');
  const result=await page.evaluate(()=>{
    const pairs=labFixture.portraits, metrics=[];
    for(let eye=0;eye<2;eye++){
      const w=pairs.day[eye].width,h=pairs.day[eye].height;const data=k=>pairs[k][eye].data;
      let count=0,shift=0,restore=0;
      for(let y=Math.floor(h*.1);y<h*.85;y++)for(let x=Math.floor(w*.27);x<w*.73;x++){
        const i=(y*w+x)*4,l1=(a,b)=>Math.abs(data(a)[i]-data(b)[i])+Math.abs(data(a)[i+1]-data(b)[i+1])+Math.abs(data(a)[i+2]-data(b)[i+2]);
        // Keep only stable painted pixels that the actor style actually changed.
        // Animated sea, controllers, and unchanged scenery aren't colour probes.
        if(l1('mmd','day')<24||l1('day','dayAgain')>2)continue;
        shift+=(data('warm')[i]-data('day')[i])-(data('warm')[i+2]-data('day')[i+2]);
        restore+=l1('mmd','restored');count++;
      }
      metrics.push({pixels:count,redMinusBlue:shift/Math.max(1,count),restoration:restore/Math.max(1,count)});
    }
    const images=['day','warm'].map(key=>{const image=pairs[key][0],canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      canvas.getContext('2d').putImageData(image,0,0);return canvas.toDataURL('image/png').split(',')[1];});
    return {metrics,images};
  });
  const label=process.env.ROOM_PORTRAIT_LABEL??'actor';assert(/^[a-z0-9-]+$/.test(label));
  const dir=path.join(__dirname,'../../local-review/screenshots/room-light');await fs.mkdir(dir,{recursive:true});
  for(const [k,name] of ['day','warm'].entries())await fs.writeFile(path.join(dir,`${label}-${room}-${name}.png`),Buffer.from(result.images[k],'base64'));
  assert(result.metrics.every(r=>r.pixels>800&&r.redMinusBlue>3&&r.restoration<1.5),JSON.stringify(result.metrics));
  await until('same held actor after both lights',(s,id)=>s.ready&&!s.physics&&!s.playing&&s.runtimeId===id,actor.runtimeId);
  await bButton();await click('settingsVrDesktopExit',{retiring:true});await until('portrait room retired',s=>s.phase==='ended'&&!s.live);
  return {room,metrics:result.metrics};
};
