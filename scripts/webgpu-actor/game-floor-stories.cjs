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
          const a=im.data,b=hidden[eye].data,c=restored[eye].data;let changed=0;
          for(let i=0;i<a.length;i+=4){
            if(Math.max(Math.abs(a[i]-c[i]),Math.abs(a[i+1]-c[i+1]),Math.abs(a[i+2]-c[i+2]))>3)continue;
            if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>15)changed++;
          }
          return changed;
        })).then(resolve,reject);
      }catch(e){finish();reject(e);}
    }};
  });
}

module.exports=async function({page,click,until,bButton,frames,target,pickMounted,ids,placeFromBag,trackAt,actorName}) {
  const adapters=await page.evaluate(()=>labFixture.adapters);
  assert(adapters.some(a=>a.xrCompatible)&&adapters.every(a=>a.vendor&&!a.fallback&&!/swiftshader|warp|llvmpipe|software/i.test(JSON.stringify(a))));
  async function bag(){await bButton();await click('hudBackpack');await click('hudToys');}
  async function equip(toy){await bag();await click('toyRight',{toy});await target({name:'watch:quiet'});await frames(3);}
  async function visit(toy,room,key){
    await bag();await click('toyGuide',{toy});await click(key);
    await until('enter '+room,(s,id)=>s.room===id&&s.ready,room);
    if(await page.evaluate(()=>!!gameTargets.find({key:'hudBack'})))await click('hudBack');
    await target({name:'watch:quiet'});
  }
  async function point(name){
    const at=await target({name});
    await page.evaluate(p=>{
      const origin=gameTargets.floorState().gl.xr.getCamera().parent;
      labSession.aimRay('right',origin.worldToLocal(origin.position.clone().fromArray(p)).toArray(),{x:.15,y:1.1,z:-.60});
    },at);await frames(3);
  }
  async function squeeze(down){
    await page.evaluate(v=>Object.assign(labSession.inputSources.find(s=>s.handedness==='right').gamepad.buttons[1],{pressed:v,touched:v,value:+v}),down);
    await frames(3);
  }
  const pixels={};
  async function checkMesh(name,min){
    pixels[name]=await page.evaluate(measureDraw,name);
    assert(pixels[name].every(n=>n>=min),name+' missing from final eye: '+pixels[name]);
  }

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

  await visit('kite','seasideTerminus','visitKite');assert(!await page.evaluate(()=>gameTargets.find({name:'play:encore-station'})||gameTargets.find({name:'play:piece:encore'})));
  const [sx,,sz]=await target({name:'story:bench-reel'});assert.deepEqual([sx,sz],[15,48]);
  // Place the actor beside the real bench, clear of both armrests. Start the
  // physical grip on the same green; the railway platform is not a launch site.
  await trackAt(sx-1.8,sz+2.8);await placeFromBag(actorName,[sx-1.8,0,sz],0);
  const actor=await until('one actor on the station green',s=>s.ready&&s.selected&&s.actor?.evaluations>0,null,90000);
  await click('hudDone');await equip('kite');await target({name:'kite:flight'});
  await pickMounted(ids.model);await click('propGive');await click('propRight');await click('storyWindLeft');
  await click('hudTools');await click('hudDone');await target({name:'watch:quiet'});
  await until('line leaves the reel on the displayed wrist and flies left',(s,id)=>{
    const scene=gameTargets.floorState().scene,eyelet=scene.getObjectByName('play:character')?.getObjectByName('kite:eyelet');
    const line=scene.getObjectByName('kite:line'),kite=scene.getObjectByName('kite:swallow');
    if(s.runtimeId!==id||!eyelet||!line||!gameTargets.find({name:'kite:sail'})||kite.position.x>-.8)return false;
    const knot=line.localToWorld(line.position.clone().fromBufferAttribute(line.geometry.attributes.position,0));
    return knot.distanceTo(eyelet.getWorldPosition(eyelet.position.clone()))<.006;
  },actor.runtimeId);
  await checkMesh('kite:sail',50);
  await bag();await click('toyStow');await until('wrist, reel and kite retired',s=>s.live===1&&!gameTargets.find({name:'play:character'})&&!gameTargets.find({name:'kite:flight'}));
  await bButton();await click('settingsVrDesktopExit',{retiring:true});
  await until('one session ended',s=>s.phase==='ended'&&!s.overlay&&!s.live);
  return {rooms:['pool','liveHouse','seasideTerminus'],placedActors:1,visiblePixelsByEye:pixels};
};
