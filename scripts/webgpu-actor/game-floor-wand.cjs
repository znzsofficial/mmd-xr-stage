const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');

// Read the held pose, then aim a simulated grip at the frontmost drawn
// triangle on a horizontal ray through the outfit. Do not call wand.query,
// move the mesh, set an expression, or drive a store from the take.
async function observeWand({runtimeId,assetId}){
  const {wandTakeSite}=await import('/scripts/webgpu-actor/wandTakeSite.js');
  const {authoredSurface}=await import('/src/mmdVrShowcase/play/authoredSurface.ts');
  const {wandCap}=await import('/src/mmdVrShowcase/play/wandHead.ts');
  const {useWandMotor}=await import('/src/mmdVrShowcase/play/wandMotor.ts');
  const {useBackpack}=await import('/src/mmdVrShowcase/backpack/store.ts');
  const {scene,gl}=gameTargets.floorState(),origin=gl.xr.getCamera().parent;
  let mesh;scene.traverse(o=>{if(o.userData.mmdModelId===runtimeId&&authoredSurface.has(o))mesh=o;});
  if(!mesh)throw Error('No authored WebGPU actor surface');
  const {site,eye}=wandTakeSite(mesh,authoredSurface.get(mesh));
  const camera=origin.worldToLocal(eye.clone());camera.z+=.33;
  const names=useBackpack.getState().live[assetId].propMorphs;
  const name=names.find(n=>/^(まばたき|瞬き|眨眼|blink|eyesclosed)$/i.test(n)&&mesh.morphTargetInfluences[mesh.morphTargetDictionary[n]]<.75);
  if(!name)throw Error('Take needs an authored blink channel on the held pose');
  const slot=mesh.morphTargetDictionary[name],base=mesh.morphTargetInfluences[slot];
  const flex=()=>scene.getObjectByName('wand:flex'),body=()=>scene.getObjectByName('play:piece:wand')?.parent;
  const capPosition=flex().children[0].geometry.attributes.position,raw=capPosition.array.slice();
  const capOffset=body().worldToLocal(flex().localToWorld(wandCap.center.clone()));
  const grip=origin.worldToLocal(site.clone()).sub(capOffset);
  const pulses=[],unhook=[];
  for(const input of labSession.inputSources){
    const pad=input.gamepad,previous=pad.hapticActuators;
    pad.hapticActuators=[{pulse(force,ms){pulses.push({hand:input.handedness,force,ms,time:performance.now()});return true;}}];
    unhook.push(()=>{pad.hapticActuators=previous;});
  }
  function move(where){
    const p=grip.clone();p.z+=where==='contact' ? .011 : .32;
    const pose={position:{x:p.x,y:p.y,z:p.z},orientation:{x:0,y:0,z:0,w:1}};
    labSession.setControllerPose('left',where==='lost'?null:pose,pose);
  }
  function button(hand,down){const b=labSession.inputSources.find(s=>s.handedness===hand).gamepad.buttons[1];Object.assign(b,{pressed:down,touched:down,value:+down});}
  function read(){
    const joint=flex(),holder=body();let compression=0;
    if(joint){const a=joint.children[0].geometry.attributes.position.array;for(let i=0;i<a.length;i++)compression=Math.max(compression,Math.abs(a[i]-raw[i]));}
    return {speed:useWandMotor.getState().speed,weight:mesh.morphTargetInfluences[slot],compression,
      hand:holder?.userData.propSource?.handedness,lamps:joint?[1,2].map(k=>scene.getObjectByName(`wand:lamp:${k}`).visible):[]};
  }
  const pictures={};
  async function flexRange(){
    const cfg=labFixture,start=performance.now();let min=Infinity,max=-Infinity;
    try{return await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('No tracked wand flex')),10000);
      cfg.take={inputs(){this.time=performance.now();},afterDraw(){const z=flex().rotation.z;min=Math.min(min,z);max=Math.max(max,z);
        if(performance.now()-start<550)return;clearTimeout(timer);cfg.take=null;resolve(max-min);}};
    });}finally{cfg.take=null;}
  }
  async function grab(label){
    const cfg=labFixture,savedX=cfg.headX;cfg.headX=camera.x;
    try{
      pictures[label]=await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('No stereo wand render')),10000);let draws=0;
        cfg.take={eyeY:camera.y,eyeZ:camera.z,inputs(){this.time=performance.now();},afterDraw(s){
          if(++draws<3)return;clearTimeout(timer);cfg.take=null;resolve(s.copyEyes());}};
      });
    }finally{cfg.take=null;cfg.headX=savedX;}
  }
  function compare(){
    const rows=['air','contact','stopped'],canvas=document.createElement('canvas');
    const {width,height}=pictures.air[0];canvas.width=width*2;canvas.height=height*3;
    rows.forEach((r,y)=>pictures[r].forEach((img,x)=>canvas.getContext('2d').putImageData(img,x*width,y*height)));
    const counts=pictures.air.map((im,i)=>{
      const diff=other=>{let n=0;for(let y=Math.floor(height*.32);y<height*.67;y++)for(let x=Math.floor(width*.2);x<width*.8;x++){
        const at=4*(y*width+x);if([0,1,2].some(k=>Math.abs(im.data[at+k]-other[i].data[at+k])>6))n++;}return n;};
      return {contact:diff(pictures.contact),restored:diff(pictures.stopped)};
    });
    return {counts,png:canvas.toDataURL().split(',')[1]};
  }
  window.wandTake={move,button,read,pulses,grab,compare,flexRange,cleanup(){unhook.forEach(fn=>fn());delete window.wandTake;}};
  move('air');return {name,page:Math.floor(names.indexOf(name)/3),base};
}

module.exports=async function({page,ids,click,aim,trigger,until,bButton,frames,target,pickMounted,idleRay}){
  const actor=await until('ready for the wand',s=>s.ready&&s.selected&&s.room==='floor'&&s.actor?.evaluations>0);
  if(actor.physics){
    await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
    await until('freeze native and GPU physics',s=>s.ready&&!s.physics&&s.actor.mode==='none');await click('hudBack');await target({name:'watch:quiet'});await pickMounted(ids.model);
  }
  await click('hudChangeMotion');await click('hudApplyBody');await until('VMD playing',s=>s.playing&&s.hasBinding&&s.time>.12);
  await bButton();await click('settingsMmdVrPause');const paused=await until('VMD held',s=>!s.playing&&s.time>0&&s.time===s.actor.poseSeconds);
  async function shelf(){await bButton();await click('hudBackpack');await click('hudToys');}
  async function equip(key){
    await shelf();for(let i=0;i<5&&!await page.evaluate(()=>!!gameTargets.find({toy:'wand',key:'toyLeft'}));i++)await click('loadNext');
    await click(key,{toy:'wand'});await target({name:'watch:quiet'});await idleRay();await frames(3);
  }
  await equip('toyLeft');
  const choice=await page.evaluate(observeWand,{runtimeId:actor.runtimeId,assetId:ids.model});
  const input=(hand,down)=>page.evaluate(([hand,down])=>wandTake.button(hand,down),[hand,down]);
  const squeeze=async(hand='left')=>{await input(hand,false);await frames(2);await input(hand,true);await frames(2);await input(hand,false);await frames(2);};
  const move=where=>page.evaluate(where=>wandTake.move(where),where);
  const read=()=>page.evaluate(()=>wandTake.read());
  const pulses=()=>page.evaluate(()=>wandTake.pulses.filter(p=>p.force>0));
  const picture=label=>page.evaluate(label=>wandTake.grab(label),label);
  try{
    await pickMounted(ids.model);await click('wandResponse');
    for(let i=0;i<choice.page;i++)await click('loadNext');
    await aim(await target({name:'hud:'+choice.name}));await trigger(true);await trigger(false);
    await click('hudTools');await click('hudDone');await target({name:'watch:quiet'});await idleRay();
    await squeeze();await page.waitForFunction(()=>wandTake.pulses.filter(p=>p.force>0).length>=3);
    const low=await pulses(),lo=low.at(-1).force,air=await read();
    assert.equal(air.speed,1);assert.deepEqual(air.lamps,[true,false]);assert.equal(air.weight,choice.base);assert.equal(air.compression,0);
    assert(low.every(p=>p.hand==='left'&&p.force===lo));const lowFlex=await page.evaluate(()=>wandTake.flexRange());assert(lowFlex>.055);
    await picture('air');
    await move('contact');
    await page.waitForFunction(({base,lo})=>wandTake.read().weight>base+.05&&wandTake.pulses.some(p=>p.force>lo),{base:choice.base,lo},{timeout:45000});
    const pressed=await read(),accent=Math.max(...(await pulses()).map(p=>p.force));assert(pressed.compression>.0001);
    await picture('contact');
    const firstTouch=(await pulses()).length;await page.waitForFunction(n=>wandTake.pulses.filter(p=>p.force>0).length>=n+2,firstTouch);
    assert((await pulses()).slice(firstTouch).every(p=>p.force===lo),'Sustained contact must not repeat the initial accent');
    await move('air');await until('release the skin',()=>wandTake.read().compression===0);
    assert.equal((await read()).weight,choice.base);
    const count=(await pulses()).length;await squeeze();await page.waitForFunction(n=>wandTake.pulses.filter(p=>p.force>0).length>=n+4,count);
    const high=(await pulses()).slice(count),hi=high.at(-1).force;
    assert.equal((await read()).speed,2);assert.deepEqual((await read()).lamps,[true,true]);assert(lo<hi&&hi<accent);
    const highFlex=await page.evaluate(()=>wandTake.flexRange());assert(highFlex>lowFlex*1.45,'High mode must visibly flex further');
    const beatMs=([a,...rest])=>rest.map(p=>{const dt=p.time-a.time;a=p;return Math.round(dt);});
    const steady=high.filter(p=>p.force===hi);assert(steady.length>=3);
    const period=p=>{const sorted=beatMs(p).sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
    assert(period(steady)<period(low)*.85,'High mode must actually run faster');
    await squeeze();assert.equal((await read()).speed,0);await move('contact');await picture('stopped');
    const stopped=await read();assert.equal(stopped.weight,choice.base);assert.equal(stopped.compression,0);
    const silent=(await pulses()).length;await frames(24);assert.equal((await pulses()).length,silent);
    const {counts,png}=await page.evaluate(()=>wandTake.compare());
    const dir=path.join(__dirname,'../../local-review/screenshots/floor-wand');await fs.mkdir(dir,{recursive:true});
    await fs.writeFile(path.join(dir,'air-contact-stopped-stereo.png'),Buffer.from(png,'base64'));
    assert(counts.every(p=>p.contact>=16&&p.restored<p.contact*.1),JSON.stringify(counts));
    await move('air');await squeeze();await input('left',true);await frames(2);await move('lost');await until('lost grip cuts motor',()=>wandTake.read().speed===0);
    const before=(await pulses()).length;await move('air');await frames(24);assert.equal((await read()).speed,0);assert.equal((await pulses()).length,before);
    await squeeze();assert.equal((await read()).speed,1);
    await page.evaluate(()=>{labFixture.tracking=false;});await frames(4);
    try{assert.equal((await read()).speed,0,'Missing headset pose must cut power even without a Fiber tick');}
    finally{await page.evaluate(()=>{labFixture.tracking=true;});}
    await frames(6);assert.equal((await read()).speed,0);
    await squeeze();await equip('toyRight');await until('right hand owns the motor',()=>wandTake.read().hand==='right'&&wandTake.pulses.at(-1)?.hand==='right');
    const switched=(await pulses()).length;await page.waitForFunction(n=>wandTake.pulses.filter(p=>p.force>0).length>=n+2,switched);
    assert((await pulses()).slice(switched).every(p=>p.hand==='right'));await shelf();await click('toyStow');await target({name:'watch:quiet'});
    await until('wand retired',()=>wandTake.read().speed===0&&!gameTargets.find({name:'play:piece:wand'}));
    const stowed=(await pulses()).length;await frames(24);assert.equal((await pulses()).length,stowed);
    await pickMounted(ids.model);await target({key:'hudChangeMotion'});
    await until('same selected paused actor',(s,p)=>s.selected&&s.hasBinding&&s.runtimeId===p.id&&s.time===p.time&&!s.playing,{id:actor.runtimeId,time:paused.time});
    return {paused:paused.time,pixels:counts,airForce:lo,highForce:hi,initialTouch:accent,lowBeatMs:beatMs(low),highBeatMs:beatMs(steady),lowFlex,highFlex,capTravelMm:pressed.compression*1000,trackingRecoveryPulses:0,stowedPulses:0};
  }finally{await page.evaluate(()=>window.wandTake?.cleanup());}
};
