const assert=require('node:assert/strict');

// Measure ONLY pixels attributable to the named draw. Hold the tracked clock
// and camera; compare submitted color/hidden/restored in both binding slices.
function measureDraw(name) {
  const cfg=window.labFixture, mesh=gameTargets.floorState().scene.getObjectByName(name);
  if(!mesh?.isMesh||!mesh.material.visible||!gameTargets.find({name}))throw Error('Missing draw: '+name);
  return new Promise((resolve,reject)=>{
    if(cfg.take)throw Error('Another XR observer is running');
    const pairs=[];
    function finish(){cfg.take=null;mesh.material.visible=true;clearTimeout(timer);}
    const timer=setTimeout(()=>{finish();reject(Error('No stereo draw of '+name));},10000);
    cfg.take={time:performance.now(),inputs(){},afterDraw(s){
      try{
        pairs.push(s.copyEyes());
        mesh.material.visible=pairs.length!==1;
        if(pairs.length!==3)return;
        finish();Promise.all(pairs).then(([shown,hidden,restored])=>shown.map((im,eye)=>{
          const a=im.data,b=hidden[eye].data,c=restored[eye].data;let changed=0,xSum=0;
          for(let i=0;i<a.length;i+=4){
            if(Math.max(Math.abs(a[i]-c[i]),Math.abs(a[i+1]-c[i+1]),Math.abs(a[i+2]-c[i+2]))>3)continue;
            if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>15){changed++;xSum+=(i/4)%im.width;}
          }
          return {changed,xFraction:changed?xSum/(changed*im.width):null};
        })).then(resolve,reject);
      }catch(e){finish();reject(e);}
    }};
  });
}

// Inspect the first *drawn* cord vertex against the displayed eyelet. The wrist
// mount is a world-space sibling of the PMX, so also locate the actual wearer's
// animated wrist; a cord connected to a floating reel must not pass.
async function observeStory() {
  const {wristSockets}=await import('/src/mmdVrShowcase/play/wristSocket.ts');
  const {useStagePlay}=await import('/src/mmdVrShowcase/play/stagePlay.ts');
  const {POST_MARKS,POST_Z,useLunarCard}=await import('/src/mmdVrShowcase/play/lunarCard.ts');
  window.storyTake={
    postMark:[...POST_MARKS[1],POST_Z],stamps:()=>useLunarCard.getState().stamps,
    empty:()=>{const {held,character,stand}=useStagePlay.getState();return !held&&!character&&!stand;},
    flight({runtimeId,assetId,hand,side}){
      const state=gameTargets.floorState(),scene=state?.scene;
      if(!scene||!gameTargets.find({name:'kite:sail'}))return false;
      const play=useStagePlay.getState(),reel=scene.getObjectByName('play:piece:kite');
      const eyelet=reel?.getObjectByName('kite:eyelet'),line=scene.getObjectByName('kite:line'),bird=scene.getObjectByName('kite:swallow');
      if(!eyelet||!line||!bird)return false;
      const from=eyelet.getWorldPosition(eyelet.position.clone());
      const knot=line.localToWorld(line.position.clone().fromBufferAttribute(line.geometry.attributes.position,0));
      if(knot.distanceTo(from)>.006 || bird.position.x*(side==='left'?-1:1)<.9)return false;
      if(assetId){
        const prop=play.character,group=scene.getObjectByName('play:character');
        if(!group?.visible||group.getObjectByName('kite:eyelet')!==eyelet||prop?.assetId!==assetId||prop.hand!==hand)return false;
        const root=scene.children.find(o=>o.userData.mmdModelId===runtimeId),wrist=root&&wristSockets(root)[hand]?.wrist;
        return !!wrist && wrist.getWorldPosition(wrist.position.clone()).distanceTo(from)<.30 && bird.position.z<-1.05;
      }
      const controller=labSession.inputSources.find(s=>s.handedness===hand);
      return !!controller?.gripSpace && reel.parent.userData.propSource===controller && play.held?.hand===hand && bird.position.z<-2.25;
    },
  };
}

module.exports=async function({page,click,until,bButton,frames,target,pickMounted,ids,placeFromBag,trackAt,actorName,first}) {
  await page.evaluate(observeStory);
  const adapters=await page.evaluate(()=>labFixture.adapters);
  assert(adapters.some(a=>a.xrCompatible)&&adapters.every(a=>a.vendor&&!a.fallback&&!/swiftshader|warp|llvmpipe|software/i.test(JSON.stringify(a))));
  async function bag(){await bButton();await click('hudBackpack');await click('hudToys');}
  async function equip(toy){
    await bag();if(toy==='post')await click('loadNext');
    await click('toyRight',{toy});await target({name:'watch:quiet'});await frames(3);
  }
  async function visit(toy,room,key){
    await bag();await click('toyGuide',{toy});await click(key);
    await until('enter '+room,(s,id)=>s.room===id&&s.ready,room);
    if(await page.evaluate(()=>!!gameTargets.find({key:'hudBack'})))await click('hudBack');
    await target({name:'watch:quiet'});
  }
  async function point(mark){
    const at=typeof mark==='string'?await target({name:mark}):mark;
    await page.evaluate(p=>{
      const origin=gameTargets.floorState().gl.xr.getCamera().parent;
      labSession.aimRay('right',origin.worldToLocal(origin.position.clone().fromArray(p)).toArray(),{x:.15,y:1.1,z:-.60});
    },at);await frames(3);
  }
  async function squeeze(down,hand='right'){
    await page.evaluate(([v,hand])=>Object.assign(labSession.inputSources.find(s=>s.handedness===hand).gamepad.buttons[1],{pressed:v,touched:v,value:+v}),[down,hand]);
    await frames(3);
  }
  const pixels={};
  async function checkMesh(name,min,label=name){
    const eyes=await page.evaluate(measureDraw,name);
    pixels[label]=eyes.map(e=>e.changed);
    assert.equal(eyes.length,2);assert(pixels[label].every(n=>n>=min),label+' missing from final eye: '+pixels[label]);
    return eyes.map(e=>e.xFraction);
  }
  async function flight(label,side,owner={}){
    await until(label,(_s,arg)=>storyTake.flight(arg),{hand:'right',side,...owner});
  }

  // Aim at a real plinth stamp's would-be world position while in the pool.
  // Removing the room-specific paper must not leave an invisible working target.
  await equip('post');await target({name:'play:piece:post'});await point(await page.evaluate(()=>storyTake.postMark));
  await squeeze(true);await squeeze(false);
  assert.deepEqual(await page.evaluate(()=>storyTake.stamps()),[]);
  assert(!await page.evaluate(()=>gameTargets.find({name:'play:moon-post'})||gameTargets.find({name:'post:aim'})));

  await equip('bubbles');await point('ferry:gate:left');await squeeze(true);
  await until('one squeeze emits real bubble instances',()=>gameTargets.floorState().scene.getObjectByName('play:bubbles')?.geometry.instanceCount>=4);
  await checkMesh('play:bubbles',35);await squeeze(false);
  await until('same squeeze launches the left boat',()=>{
    const boat=gameTargets.floorState().scene.getObjectByName('ferry:boat');return boat?.visible&&boat.scale.x>.95&&boat.userData.departure==='left';
  });await checkMesh('ferry:launch',40);

  await visit('encore','liveHouse','visitEncore');assert(!await page.evaluate(()=>gameTargets.find({name:'play:ferry-station'})||gameTargets.find({name:'play:piece:bubbles'})));
  await equip('encore');
  for(const side of ['right','left']){await point('encore:target:'+side);await squeeze(true);await squeeze(false);}
  await until('ink reaches the opposite end of the curtain',()=>gameTargets.floorState().scene.getObjectByName('encore:print:right')?.material.uniforms.uReach.value>1);
  await checkMesh('encore:print:right',2500);

  // The wearer is in a room with its own *different* story. Use the selected
  // character's sheet and verify a second actor cannot issue its wind cues.
  await placeFromBag(actorName,[0,0,-2.6],0);
  const actor=await until('wearer placed in Live House',s=>s.ready&&s.selected&&s.actor?.evaluations>0,null,90000);
  const wearer={runtimeId:actor.runtimeId,assetId:ids.model};
  await click('hudDone');await equip('kite');await flight('controller launches in Live House','right');
  await squeeze(true);await flight('controller squeeze switches wind in Live House','left');await squeeze(false);
  await checkMesh('kite:sail',50,'clubGrip:left');
  await pickMounted(ids.model);await click('propGive');await click('propRight');
  await flight('wrist transfer preserves the existing wind','left',wearer);
  assert(!await page.evaluate(()=>gameTargets.find({key:'storyDyeLeft'})||gameTargets.find({name:'story:bench-reel'})));
  await click('hudTools');await click('hudDone');
  await placeFromBag(first,[1.35,0,-2.1],1,1);
  await until('second actor selected',(s,name)=>s.ready&&s.live===2&&gameTargets.model(name).selected,first,90000);
  await target({key:'hudDone'});
  assert(!await page.evaluate(()=>['propGive','propGrip','storyWindLeft','storyWindRight'].some(key=>gameTargets.find({key}))));
  await flight('original wrist still owns left wind','left',wearer);await click('hudDone');
  const wristX={};
  for(const side of ['right','left']){
    await pickMounted(ids.model);await click('propGrip');
    await click(side==='left'?'storyWindLeft':'storyWindRight');
    await click('hudTools');await click('hudDone');await target({name:'watch:quiet'});
    await flight('wrist wind '+side,side,wearer);
    wristX[side]=await checkMesh('kite:sail',50,'wrist:'+side);
  }
  assert(wristX.left.every((x,i)=>wristX.right[i]-x>.12),'Wind buttons must move the visible sail across both eye images: '+JSON.stringify(wristX));
  await bag();await click('toyStow');
  await until('stow removes the wrist, reel and flight but leaves both actors',s=>{
    const scene=gameTargets.floorState().scene;
    return s.live===2&&storyTake.empty()&&!['play:character','play:piece:kite','kite:flight'].some(name=>scene.getObjectByName(name));
  });

  await visit('kite','seasideTerminus','visitKite');assert(!await page.evaluate(()=>gameTargets.find({name:'play:encore-station'})||gameTargets.find({name:'play:piece:encore'})));
  const [sx,,sz]=await target({name:'story:bench-reel'});assert.deepEqual([sx,sz],[15,48]);
  await equip('kite');await flight('platform controller owns the reel','right');
  const [x,,z]=await target({name:'kite:eyelet'});assert(Math.hypot(x-sx,z-sz)>25,'Expected the tracked grip on the platform, far from the green');
  await squeeze(true,'left');await squeeze(false,'left');await flight('opposite grip leaves wind alone','right');
  await squeeze(true);await flight('right-controller squeeze flies left on the platform','left');await squeeze(false);
  await checkMesh('kite:sail',50,'platform:left');
  await trackAt(sx-1.8,sz+2.8);await flight('same held flight arrives on the green','left');
  await squeeze(true);await flight('next squeeze reverses wind on the green','right');await squeeze(false);
  await checkMesh('kite:sail',50,'green:right');
  await bButton();await click('settingsVrDesktopExit',{retiring:true});
  await until('exit retires the active controller kite',s=>s.phase==='ended'&&!s.overlay&&!s.live&&storyTake.empty());
  return {rooms:['pool','liveHouse','seasideTerminus'],placedActors:2,visiblePixelsByEye:pixels,wristSailXByEye:wristX};
};
