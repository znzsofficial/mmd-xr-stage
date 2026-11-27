import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {cast} from './layout-cast.mjs';
import {signs} from './layout-signs.mjs';

export async function observeLayout(){
  const {useBackpack}=await import('/src/mmdVrShowcase/backpack/store.ts');
  const {useMmdVrStore}=await import('/src/mmdVrShowcase/mmdVrStore.ts');
  const {getMmdVrClock}=await import('/src/mmdVrShowcase/stage/mmdVrClock.ts');
  window.gameTargets=await import('/scripts/webgpu-actor/game-floor-targets.js');
  const originals=[...useBackpack.getState().files];
  window.layoutState=()=>{
    const bag=useBackpack.getState(),stage=useMmdVrStore.getState();
    return {playing:stage.playing,time:getMmdVrClock().time,room:stage.prefs.scenery,
      ready:!!stage.captureStage&&!bag.busy&&!stage.assetLoad.running&&!stage.physicsBusy,
      intact:originals.length===bag.files.length&&originals.every((file,i)=>file===bag.files[i])&&Object.values(bag.bindings).every(b=>!b.body||originals.includes(b.body)),
      error:bag.error||stage.physicsError||stage.assetLoad.failures[0]?.message||document.querySelector('.stage-intro [role="alert"]')?.textContent,
      items:bag.entries.filter(e=>bag.live[e.id]).map(e=>{
        const entry=bag.live[e.id],transform=[...stage.models,...stage.objects].find(t=>t.id===entry.runtimeId);
        return {name:e.file.name,asset:e.id,id:entry.runtimeId,position:entry.position,selected:bag.selected===e.id,
          formVisible:stage.materialModels[entry.runtimeId]?.find(m=>m.name==='form')?.visible,
          motion:bag.bindings[e.id]?.body?.name,scale:transform?.scale,yaw:transform?.rotationY};
      })};
  };
}

async function eyePair({signs,cast,save,controls}){
  const cfg=window.labFixture,s=window.labSession;
  return new Promise((done,fail)=>{
    const timer=setTimeout(()=>{cfg.take=null;fail(Error('No tracked color readback'));},16000);
    cfg.take={inputs(){this.time=performance.now();},afterDraw(){
      cfg.take=null;clearTimeout(timer);
      const {scene,gl}=gameTargets.floorState(),cams=gl.xr.getCamera().cameras,items=layoutState().items;
      try{
        // The VMD may advance again before mapAsync resolves. Project the
        // bone and sign landmarks inside the very frame that supplies color.
        const reads=cams.map(cam=>{
          const sites=[];
          const defer=(u,v)=>{const rgb=[];sites.push({u,v,rgb});return rgb;};
          const sample=layoutPixels(scene,cam,defer,{cast,signs,items});
          sample.controls=controls.map(site=>{const p=cam.position.clone().fromArray(site).project(cam);return defer((p.x+1)/2,(1-p.y)/2);});
          return {sites,sample};
        });
        s.copyEyes().then(pair=>done(pair.map((image,i)=>{
          const {sites,sample}=reads[i];
          for(const {u,v,rgb} of sites){
            const x=4+Math.floor(u*(image.width-8)),y=5+Math.floor(v*(image.height-10));
            const k=4*(x+y*image.width);rgb.push(...image.data.slice(k,k+3));
          }
          if(save){const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').putImageData(image,0,0);sample.png=c.toDataURL('image/png').split(',')[1];}
          return sample;
        }))).catch(fail);
      }catch(e){fail(e);}
    }};
  });
}

function verifyPeople(read,names,hiddenForm){
  assert.deepEqual(read.map(p=>p.name).sort(),[...names].sort());
  for(const p of read){
    if(p.name===hiddenForm)continue;
    const color=cast.find(c=>c.name===p.name).color;
    const absent=color.indexOf(Math.min(...color)),others=p.rgb.filter((_,i)=>i!==absent);
    assert(Math.min(...others)>p.rgb[absent]+24,`Skinned ${p.name} torso pigment missing: ${p.rgb}`);
  }
}

function compareLayout(before,after){
  assert.deepEqual(after.map(x=>x.name).sort(),before.map(x=>x.name).sort());
  for(const prev of before){
    const next=after.find(v=>v.name===prev.name);
    assert.deepEqual([next.motion,next.asset,next.scale],[prev.motion,prev.asset,prev.scale],prev.name);
    assert(Math.abs(next.yaw-prev.yaw)<1e-4,prev.name+' heading changed');
    assert(prev.position.every((v,i)=>Math.abs(v-next.position[i])<1e-4),prev.name+' moved');
  }
}

export async function runMixedTake({page,btn,screen,exit,place,sample,select,output,verifyPaint}){
  const state=()=>page.evaluate(()=>layoutState());
  async function wait(predicate,arg=null){
    const check=`(() => {const s=layoutState();if(s.error)throw Error(s.error);return (${predicate})(s,${JSON.stringify(arg)});})()`;
    await (await page.waitForFunction(check,null,{timeout:45000})).dispose();return state();
  }
  const people=cast.map(c=>c.name),props=signs.map(s=>s.name);
  const all=[...people,...props],removed=[people[1],props[1]];
  const actorX=[-1.9,-.24,1.45],signX=[-1.05,.62,2.3];
  await screen();
  for(const [i,actor] of cast.entries()){
    await place(actor.name,actorX[i],-3.25);await btn('动作').click();
    const field=page.locator('.screen-tool-detail select').first();
    const option=field.locator('option').filter({hasText:actor.motion});await field.selectOption(await option.getAttribute('value'));
    await wait((s,n)=>s.ready&&s.items.some(i=>i.motion===n),actor.motion);
  }
  for(const [i,p] of props.entries())await place(p,signX[i],-3.1);
  const play=page.locator('.screen-play');if((await state()).playing)await play.click();
  const seek=page.locator('.screen-transport input[type=range]');await seek.focus();await seek.press('Home');
  await wait(s=>s.ready&&!s.playing&&s.time===0);
  const start=await sample();verifyPeople(start.people,people);verifyPaint(start.props,props);
  await play.click();await wait(s=>s.time>.9);await play.click();
  const held=await wait(s=>s.ready&&!s.playing&&s.items.length===6),pose=await sample();
  verifyPeople(pose.people,people);verifyPaint(pose.props,props);
  for(const a of pose.people){const prev=start.people.find(p=>p.name===a.name);assert(Math.hypot(...a.point.map((v,i)=>v-prev.point[i]))>.055,`${a.name}: bound VMD did not move torso`);}
  await page.locator('.screen-picture canvas').screenshot({path:join(output,'webgl-six.png')});
  await exit();await page.locator('.stage-launch-row .stage-btn-secondary[data-xr-backend="webgpu"]').click();
  await page.locator('[data-xr-host="webgpu"][data-phase="active"]').waitFor();
  const initial=await wait(s=>s.ready&&s.items.length===6);assert.equal(initial.time,held.time);compareLayout(held.items,initial.items);

  async function frames(n=2){const target=await page.evaluate(n=>labSession.stats.frames+n,n);await (await page.waitForFunction(t=>labSession.stats.frames>=t,target)).dispose();}
  async function buttonB(){
    for(const down of [false,true,false]){await page.evaluate(d=>{
      const b=labSession.inputSources.find(i=>i.handedness==='right').gamepad.buttons[5];Object.assign(b,{pressed:d,touched:d,value:Number(d)});
    },down);await frames();}
  }
  async function click(spec){
    await page.evaluate(spec=>{window.mixedStep=spec;},spec);
    const h=await page.waitForFunction(spec=>gameTargets.find(spec),spec),point=await h.jsonValue();await h.dispose();
    await page.evaluate(p=>labSession.aimRay('right',p,{x:.17,y:1.95,z:-.42}),point);await frames(4);
    for(const down of [true,false]){await page.evaluate(d=>labSession.queueSelect('right',d),down);await frames(4);}
  }
  const key=key=>click({key}),has=key=>page.evaluate(key=>!!gameTargets.find({key}),key);
  async function quiet(){if(await has('hudBack'))await key('hudBack');if(await has('hudDone'))await key('hudDone');await page.evaluate(()=>labSession.aimRay('right',null));await frames();}
  async function eyes(tag,names,controls=[],hiddenForm){
    const pair=await page.evaluate(eyePair,{cast,signs,save:!!tag,controls});
    for(const [i,eye] of pair.entries()){
      if(tag){await writeFile(join(output,`${tag}-${i?'right':'left'}.png`),Buffer.from(eye.png,'base64'));delete eye.png;}
      verifyPeople(eye.people,names.filter(n=>people.includes(n)),hiddenForm);verifyPaint(eye.props,names.filter(n=>props.includes(n)));
    }return pair;
  }
  async function goRoom(keyName,id,count){
    if(!await has('hudScenery'))await buttonB();await key('hudScenery');await key(keyName);
    return wait((s,[id,count])=>s.room===id&&s.ready&&s.items.length===count,[id,count]);
  }
  await quiet();const six=await eyes('webgpu-six',all);
  for(const p of six[0].people){const prev=pose.people.find(a=>a.name===p.name);assert(Math.hypot(...p.point.map((v,i)=>v-prev.point[i]))<.025,p.name+' restored the wrong motion pose');}
  const session=await page.evaluate(()=>({adapters:labFixture.adapters,slices:labSession.stats.slices}));
  assert.deepEqual(session.slices,{left:0,right:1});assert(session.adapters.some(a=>a.xrCompatible&&a.vendor&&!a.fallback&&!/warp|swiftshader|llvmpipe/i.test(JSON.stringify(a))));
  const materialTarget=initial.items.find(i=>i.name===people[1]);
  // The generated swatches share a slot NAME, but the action must change
  // only this runtime. Return to the same quiet framing before each read.
  async function toggleForm(visible){
    await click({name:`backpack:pick:${materialTarget.asset}`});await key('watchArrange');await key('watchDetails');
    await key('settingsMmdVrMaterials');await click({name:'hud:form'});await key(visible?'settingsMmdVrShowModel':'settingsMmdVrHideModel');
    await wait((s,[id,shown])=>s.items.filter(i=>i.motion).every(i=>i.formVisible===(i.id===id?shown:true)),[materialTarget.id,visible]);
    await key('settingsMmdVrMaterials');await key('hudModels');await quiet();
  }
  const skeletons=()=>page.evaluate(()=>{
    const scene=gameTargets.floorState().scene;
    return layoutState().items.filter(i=>i.motion).map(item=>{
      const root=scene.children.find(o=>o.userData.mmdModelId===item.id);let skeleton;
      root.traverse(o=>{skeleton??=o.skeleton;});
      return [item.id,skeleton.bones.map(b=>b.matrixWorld.toArray())];
    });
  });
  const bones=await skeletons();await toggleForm(false);
  const hidden=await eyes('webgpu-one-slot-hidden',all,[],materialTarget.name);assert.deepEqual(await skeletons(),bones);
  for(const [i,eye] of hidden.entries())for(const p of eye.people){
    const old=six[i].people.find(a=>a.name===p.name);
    if(p.name===materialTarget.name){
      const changed=p.patch.filter((rgb,j)=>rgb.some((v,k)=>Math.abs(v-old.patch[j][k])>30));
      assert(changed.length>=7,`Eye ${i}: hidden form still drawn (${changed.length}/9 changed)`);
    }else assert.deepEqual(p.patch,old.patch,`Eye ${i}: hiding ${materialTarget.name} changed ${p.name}`);
  }
  await toggleForm(true);const shown=await eyes(null,all);assert.deepEqual(await skeletons(),bones);
  for(const [i,eye] of shown.entries())for(const p of eye.people)assert.deepEqual(p.patch,six[i].people.find(a=>a.name===p.name).patch,`Eye ${i}: ${p.name} did not return to original pixels`);
  await buttonB();await key('settingsMmdVrPlay');await wait(s=>s.playing&&s.time%2>1.7&&s.time%2<1.85);
  const dancing=await eyes(null,all);
  for(const actor of dancing[0].people){const prev=six[0].people.find(p=>p.name===actor.name);assert(Math.hypot(...actor.point.map((v,i)=>v-prev.point[i]))>.055,actor.name+' failed to animate in XR');}
  await buttonB();await key('settingsMmdVrPause');const xrHold=await wait(s=>s.ready&&!s.playing);
  await goRoom('hudClassroom','classroom',0);await goRoom('hudLawn','lawn',6);await quiet();
  compareLayout(held.items,(await state()).items);assert.equal((await state()).time,xrHold.time);await eyes(null,all);
  // Exit and resume the COMPLETE six-asset layout once before deleting either
  // target: both backends have to draw 3+3 on an actual restored clock.
  async function leaveXR(){
    if(!await has('settingsVrDesktopExit'))await buttonB();
    const h=await page.waitForFunction(()=>gameTargets.find({key:'settingsVrDesktopExit'})),p=await h.jsonValue();await h.dispose();
    await page.evaluate(p=>labSession.aimRay('right',p,{x:.17,y:1.95,z:-.42}),p);await frames(4);
    await page.evaluate(()=>labSession.queueSelect('right',true));await frames(3);await page.evaluate(()=>labSession.queueSelect('right',false));
    await page.locator('[data-xr-host="webgpu"]').waitFor({state:'detached'});
  }
  await leaveXR();await screen();const back=await wait(s=>s.items.length===6&&s.ready);compareLayout(held.items,back.items);assert.equal(back.time,xrHold.time);
  const returned=await sample();verifyPeople(returned.people,people);verifyPaint(returned.props,props);await exit();
  await page.locator('.stage-launch-row .stage-btn-secondary[data-xr-backend="webgpu"]').click();
  const live=await wait(s=>s.items.length===6&&s.ready&&!!gameTargets.floorState());await quiet();
  const beforeRemoval=await eyes(null,all);
  for(const name of removed){
    const item=live.items.find(i=>i.name===name);await click({name:`backpack:pick:${item.asset}`});
    await wait((s,n)=>s.items.some(i=>i.selected&&i.name===n),name);if(people.includes(name))await key('watchArrange');await key('hudPutAway');
    await wait((s,n)=>s.ready&&!s.items.some(i=>i.name===n),name);
  }
  const left=all.filter(n=>!removed.includes(n));await quiet();
  const point=beforeRemoval[0].people.find(p=>p.name===removed[0]).point;
  const paint=beforeRemoval[0].props.find(p=>p.name===removed[1]).paintSite;
  const four=await eyes('webgpu-after-removal',left,[point,paint]);
  for(const [i,eye] of four.entries()){
    const was=beforeRemoval[i].people.find(p=>p.name===removed[0]).rgb;
    assert(Math.max(...eye.controls[0].map((c,j)=>Math.abs(c-was[j])))>30,'Removed actor still painted at torso');
    const green=beforeRemoval[i].props.find(p=>p.name===removed[1]).background;
    assert(Math.max(...eye.controls[1].map((c,j)=>Math.abs(c-green[j])))>30,'Removed glTF still painted at sign');
  }
  const survivors=held.items.filter(i=>left.includes(i.name));compareLayout(survivors,(await state()).items);
  await leaveXR();await screen();const final=await wait(s=>s.ready&&s.items.length===4);compareLayout(survivors,final.items);assert(final.intact);
  const last=await sample();verifyPeople(last.people,left.filter(n=>people.includes(n)));verifyPaint(last.props,left.filter(n=>props.includes(n)));
  await select(people[0]);await btn('动作').click();assert.equal(await page.locator('.screen-tool-detail select').first().locator('option:checked').textContent().then(s=>s.endsWith(cast[0].motion)),true);
  await exit();console.log('Mixed WebGL / WebGPU XR / WebGL:',JSON.stringify({webglHeld:held.time,xrHeld:xrHold.time,filesIntact:final.intact,eyes:six,survivors:left}));
}
