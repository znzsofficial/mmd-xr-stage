const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');

// Both eyes, same camera and VMD pose. Hide ONLY the silicone drawing during
// the second exposure to isolate the response on the original PMX outfit.
function picture([site,label]){
  const {scene,gl}=gameTargets.floorState(),shell=scene.getObjectByName('play:remote-wearable'),piece=shell.getObjectByName('egg:silicone');
  const position=shell.getWorldPosition(shell.position.clone());if(!shell.visible)throw Error('No worn receiver');
  const cfg=labFixture;cfg.eggCamera??={};const eye=cfg.eggCamera[site]??=gl.xr.getCamera().parent.worldToLocal(position.clone());return new Promise((resolve,reject)=>{
    const captures=[];let n=0;const finish=()=>{piece.visible=true;clearTimeout(timer);cfg.take=null;};
    const timer=setTimeout(()=>{finish();reject(Error('No stereo wearable render'));},12000);
    cfg.take={eyeY:eye.y,eyeZ:eye.z+.64,inputs(){this.time=performance.now();},afterDraw(s){
      if(++n<4)return;captures.push(s.copyEyes());piece.visible=false;if(n<5)return;finish();
      Promise.all(captures).then(eyes=>{const canvas=document.createElement('canvas');canvas.width=eyes[0][0].width*2;canvas.height=eyes[0][0].height*2;
        ((cfg.eggPixels??={})[site]??={})[label]=eyes[1];
        eyes.forEach((row,y)=>row.forEach((eye,x)=>canvas.getContext('2d').putImageData(eye,x*eye.width,y*eye.height)));
        resolve({at:position.toArray(),png:canvas.toDataURL().split(',')[1]});},reject);
    }};
  });
}
module.exports=async function({page,ids,click,until,bButton,frames,target,pickMounted}){
  const actor=await until('clothed actor ready',s=>s.ready&&s.selected&&s.actor?.evaluations>0,null,120000);
  await click('hudDone');
  await bButton();await click('hudBackpack');await click('hudToys');
  for(let i=0;i<5&&!await page.evaluate(()=>!!gameTargets.find({toy:'remoteEgg',key:'toyLeft'}));i++)await click('loadNext');
  await click('toyLeft',{toy:'remoteEgg'});await target({name:'watch:quiet'});await pickMounted(ids.model);await click('eggWear');
  await page.evaluate(async()=>{window.eggState=(await import('/src/mmdVrShowcase/play/remote/remoteMotor.ts')).useRemoteEgg.getState;});
  if(actor.physics){
    for(const key of ['eggCloth','eggChest']){await click(key);await frames(8);assert(await page.evaluate(()=>!!gameTargets.find({name:'play:remote-wearable'})&&eggState().mode===1),'wearable missing during ordinary physics: '+key);}
    await click('eggCloth');await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
    await until('fixed pose',s=>s.ready&&!s.physics&&s.actor.mode==='none');await click('hudBack');await target({name:'watch:quiet'});await pickMounted(ids.model);await click('eggControls');
  }
  const dir=path.join(__dirname,'../../local-review/screenshots/remote-egg');await fs.mkdir(dir,{recursive:true});
  const grab=async(site,label)=>{const {at,png}=await page.evaluate(picture,[site,label]);await fs.writeFile(path.join(dir,`gpu-${site}-${label}.png`),Buffer.from(png,'base64'));return at;};
  const open=async()=>{await pickMounted(ids.model);await click('eggControls');};
  const close=async()=>{await click('hudTools');await click('hudDone');await target({name:'watch:quiet'});};
  const result={};for(const site of ['cloth','chest']){
    if(site==='chest'){await open();await click('eggChest');await click('eggSteady');}
    await close();await until('held running motor',()=>eggState().mode===1);
    const on=await grab(site,'on');await frames(3);await grab(site,'on2');await open();await click('eggStop');await close();const off=await grab(site,'off');
    const stopped=await grab(site,'restored');assert.deepEqual(stopped,off);
    const pixels=await page.evaluate(site=>{const {on,on2,off,restored}=labFixture.eggPixels[site];return off.map((im,eye)=>{
      function changes(other,threshold){let n=0;for(let i=0;i<im.data.length;i+=4){if(Math.max(...[0,1,2].map(k=>Math.abs(im.data[i+k]-other[eye].data[i+k])))>threshold)n++;}return n;}
      return {running:Math.max(changes(on,12),changes(on2,12)),stopped:changes(restored,0)};
    });},site);assert(pixels.every(eye=>eye.running>20&&eye.stopped===0),JSON.stringify(pixels));result[site]={on,off,pixels};
  }
  await open();await click('eggSteady');await close();await page.evaluate(()=>{labSession.setControllerPose('left',null,null);});await until('lost controller stops',()=>eggState().mode===0);
  await page.evaluate(()=>{const pose={position:{x:-.24,y:1.12,z:-.45},orientation:{x:0,y:0,z:0,w:1}};labSession.setControllerPose('left',pose,pose);});await frames(5);
  assert.equal(await page.evaluate(()=>eggState().mode),0);
  await open();await click('eggSteady');await close();await bButton();await click('hudScenery');await click('hudPool');
  await until('room change retired running wearable',s=>s.room==='pool'&&s.ready&&!s.live&&!eggState().assetId&&!gameTargets.find({name:'play:remote-wearable'}));
  if(!await page.evaluate(()=>!!gameTargets.find({key:'settingsVrDesktopExit'})))await bButton();await click('settingsVrDesktopExit',{retiring:true});await until('retired wearable',s=>s.phase==='ended'&&!s.live&&!eggState().assetId);
  return result;
};
