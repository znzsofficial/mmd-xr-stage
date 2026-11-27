// One held PMX on the actual stage. Change settings with the physical B/trigger
// path, retire the menu, then sample the same pixels of both projection slices.
const assert=require('node:assert/strict');

exports.display=function(){
  localStorage.setItem('neko-virt-os.mmd-vr-showcase.v2',JSON.stringify({scenery:'floor',antialiasPref:'on',frameRatePref:'120',
    advancedRenderOverrides:true,framebufferScalePref:'0.85',foveationPref:'high',shadowsPref:'off'}));
  const request=navigator.xr.requestSession.bind(navigator.xr);
  navigator.xr.requestSession=async(...args)=>{const s=await request(...args);
    s.supportedFrameRates=[120,72,90];s.updateTargetFrameRate=async rate=>{s.hint=rate;};return s;};
  window.XRGPUBinding=class extends window.XRGPUBinding{
    createProjectionLayer(init){
      labFixture.scaleRequest=init.scaleFactor;labFixture.scaleLimit=.75;
      const layer=super.createProjectionLayer(init);let foveation=0;
      Object.defineProperty(layer,'fixedFoveation',{get:()=>foveation,set:value=>{foveation=Math.min(.25,value);}});
      return layer;
    }
  };
};

exports.run=async function({page,bButton,click,aim,trigger,target,until,frames,idleRay,shadowSources}){
  const actor=await until('PMX attached for the environment comparison',s=>s.ready&&s.visible&&s.actor?.evaluations>0,null,90000);
  const quiet=async()=>{await click('hudBack');await target({name:'watch:quiet'});await idleRay();await frames(4);};
  const environment=async()=>{await bButton();await click('hudMore');await click('settingsEnvironment');};
  const aimClick=async point=>{await aim(point);await trigger(true);await trigger(false);};
  const setting=async key=>aimClick(await target({setting:key}));
  const slider=async(section,uv)=>aimClick(await page.evaluate(([section,u])=>{
    const group=gameTargets.floorState().scene.getObjectByName('settings:'+section);let plane;
    group.traverse(o=>{if(o.isMesh&&o.renderOrder===33&&o.material.opacity===0)plane=o;});
    if(!plane)throw Error('Missing real HUD slider');
    return plane.localToWorld(plane.position.clone().set((u-.5)*plane.geometry.parameters.width,0,0)).toArray();
  },[section,uv]));
  await bButton();await click('hudMore');await click('settingsCharacter');if(actor.physics)await click('settingsMmdVrPhysicsOn');
  await until('held static actor',s=>s.ready&&!s.playing&&!s.physics&&s.actor.mode==='none');await quiet();
  const snap=async(name,same=true,at=null)=>page.evaluate(async([name,same,at])=>{
    labFixture.sameEye=same;
    if(at)labFixture.headX=at[0];
    const eyes=await new Promise((ok,fail)=>{let draws=3;const timer=setTimeout(()=>{labFixture.take=null;fail(Error('No rendered samples'));},10000);
      labFixture.take={eyePitch:at?.[4]??-.18,eyeYaw:at?.[3],eyeY:at?.[1],eyeZ:at?.[2],inputs(){this.time=performance.now();},afterDraw(s){if(--draws)return;
        clearTimeout(timer);labFixture.take=null;ok(s.copyEyes());}};
    });
    (labFixture.settingsEyes??={})[name]=eyes;
    let different=0;for(let i=0;i<eyes[0].data.length;i+=4)if([0,1,2].some(c=>eyes[0].data[i+c]!==eyes[1].data[i+c]))different++;
    labFixture.sameEye=false;labFixture.headX=0;return different;
  },[name,same,at]);
  const diff=(a,b)=>page.evaluate(([a,b])=>labFixture.settingsEyes[a].map((eye,i)=>{
    const target=labFixture.settingsEyes[b][i].data;let changed=0;
    for(let k=0;k<eye.data.length;k+=4)if([0,1,2].some(c=>Math.abs(eye.data[k+c]-target[k+c])>2))changed++;
    return changed;
  }),[a,b]);
  assert.equal(await snap('off'),0);
  await environment();await setting('settingsMmdVrShadows');await quiet();assert.equal(await snap('on'),0);
  const parallax=await snap('stereo',false);assert(parallax>300);
  await page.evaluate(async()=>{
    const {useRenderDiagnostics}=await import('/src/mmdVrShowcase/diagnostics/renderDiagnostics.ts');
    await new Promise(ok=>{const unsubscribe=useRenderDiagnostics.subscribe(()=>{unsubscribe();ok();});});
  });
  if(shadowSources){
    await bButton();await click('hudBackpack');await click('hudObjects');await aimClick(await target({key:'hudPlace',row:'ruby.glb'}));
    await aim([-.92,.012,-2.12]);await trigger(true);await trigger(false);
    await until('GLB mounted beside the held PMX',s=>s.ready&&s.live===2);await click('hudDone');await idleRay();
    async function isolate(source){
      const meshes=await page.evaluate(source=>{
        const {scene}=gameTargets.floorState(),casters=[];let receivers=0,proxies=0;
        scene.traverseVisible(o=>{
          if(!o.isMesh)return;
          if(o.userData.mmdTslShadowCaster)proxies++;
          let p=o;while(p&&!(source==='pmx'?p.userData.mmdModelId:source==='glb'?p.userData.stagePropSolid:p.name==='scenery:classroom'))p=p.parent;
          if(!p)return;
          if(o.castShadow)casters.push(o);if(o.receiveShadow)receivers++;
        });labFixture.casters=casters;
        return {casters:casters.length,receivers,proxies};
      },source);
      assert.equal(meshes.proxies,0);if(source==='pmx')assert.equal(meshes.receivers,0);
      assert.equal(await snap(source+'On'),0);
      try{await page.evaluate(()=>labFixture.casters.forEach(o=>{o.castShadow=false;}));await snap(source+'Off');}
      finally{await page.evaluate(()=>labFixture.casters.forEach(o=>{o.castShadow=true;}));}
      await snap(source+'Restored');const pixels=await diff(source+'On',source+'Off'),residual=await diff(source+'On',source+'Restored');
      assert(residual.every(n=>n===0),JSON.stringify({source,residual}));return {...meshes,pixels,residual};
    }
    const pmx=await isolate('pmx'),glb=await isolate('glb');
    assert(pmx.casters>0 && pmx.pixels.every(n=>n>80),'Expected a ground-shadow-casting reference PMX: '+JSON.stringify(pmx));
    assert(glb.pixels.every(n=>n>80),JSON.stringify(glb));
    await bButton();await click('hudScenery');await click('hudClassroom');await until('classroom shadow casters',s=>s.ready&&s.room==='classroom'&&!s.live);
    await click('hudBack');await idleRay();await frames(8);const scenery=await isolate('scenery');
    assert(scenery.pixels.every(n=>n>80),JSON.stringify(scenery));
    await page.locator('.xr-stage-exit').click();await until('shadow attribution complete',s=>s.phase==='ended');return {pmx,glb,scenery};
  }
  await environment();await setting('settingsMmdVrShadows');await quiet();assert.equal(await snap('restored'),0);
  const shadows=await diff('on','off'),restoration=await diff('restored','off');
  assert(shadows.every(n=>n>80)&&restoration.every(n=>n===0),JSON.stringify({shadows,restoration}));
  await environment();await slider('environment',.96);await quiet();await snap('exposure');
  const exposure=await diff('off','exposure');assert(exposure.every(n=>n>1000));
  await environment();await click('settingsMmdVrValueReset');await click('settingsVisualDetails');await setting('hudSoftHighlights');await quiet();await snap('soft');
  const highlights=await diff('off','soft');assert(highlights.every(n=>n>1000));
  await environment();await click('settingsVisualDetails');await setting('hudSoftHighlights');await setting('settingsMmdVrGrid');await setting('settingsFog');await slider('visual-details',.90);
  await frames(4);
  const room=await page.evaluate(()=>{const {gl,scene}=gameTargets.floorState();return {fog:!!scene.fog,far:labSession.renderState.depthFar,
    grid:!!scene.getObjectByProperty('type','GridHelper'),exposure:gl.toneMappingExposure};});
  assert(room.far>75 && !room.grid && !room.fog && room.exposure===1,JSON.stringify(room));
  await click('settingsBackEnvironment');await click('hudDiagnostics');await target({key:'settingsPanelFps'});
  const diag=await page.evaluate(async()=>{const {useRenderDiagnostics}=await import('/src/mmdVrShowcase/diagnostics/renderDiagnostics.ts');return useRenderDiagnostics.getState().current;});
  assert.deepEqual(diag.requested,{frameRate:'120 Hz',antialias:true,framebufferScale:.85,foveation:1});
  assert.deepEqual([diag.refreshRate,diag.targetSamples,diag.width,diag.height,diag.foveation,diag.contextAntialias,diag.layerAntialias],[72,4,480,480,.25,null,null]);
  assert.deepEqual(await page.evaluate(()=>[labSession.hint,labFixture.scaleRequest]),[120,.85]);
  assert(await page.evaluate(()=>labFixture.adapters.some(a=>a.vendor&&a.xrCompatible&&!a.fallback&&!/warp|swiftshader|llvmpipe|software/i.test(JSON.stringify(a)))));
  await click('hudBack');await bButton();await click('hudScenery');await click('hudClinic');
  await until('clinic mounted',s=>s.ready&&s.room==='clinic'&&s.modelCount===0);
  const localClick=async key=>{
    const p=await target({key});const q=await page.evaluate(p=>{const base=gameTargets.floorState().gl.xr.getCamera().parent;
      return base.worldToLocal(base.position.clone().fromArray(p)).toArray();},p);
    await aimClick(q);
  };
  await localClick('hudMore');await localClick('settingsEnvironment');await localClick('sceneryPeopleOff');
  await target({name:'scenery:clinic-nurse'});
  const at=await page.evaluate(async()=>{const {roomViews}=await import('/src/mmdVrShowcase/scenery/roomViews.ts');
    const shot=roomViews.clinic.shots.find(s=>s.key==='clinicDeskSide'),base=gameTargets.floorState().gl.xr.getCamera().parent;
    const point=p=>base.worldToLocal(base.position.clone().fromArray(p)),eye=point(shot.eye),dir=point(shot.aim).sub(eye).normalize();
    return [...eye.toArray(),Math.atan2(-dir.x,-dir.z),Math.asin(dir.y)];});
  await localClick('hudBack');await idleRay();await snap('nurse',true,at);
  await bButton();await localClick('hudMore');await localClick('settingsEnvironment');await localClick('sceneryPeopleOn');
  await localClick('hudBack');await idleRay();await snap('vacant',true,at);
  const nurse=await diff('nurse','vacant');assert(nurse.every(n=>n>80),JSON.stringify(nurse));
  await page.locator('.xr-stage-exit').click();await until('environment report published',s=>s.phase==='ended'&&!s.overlay);
  const report=await page.evaluate(async()=>{const {useLastPerformanceReport}=await import('/src/mmdVrShowcase/diagnostics/performanceReport.ts');return useLastPerformanceReport.getState().report;});
  assert.deepEqual(report.eyeViewports,[{eye:'left',width:472,height:470},{eye:'right',width:472,height:470}]);
  assert(report.windows.some(w=>w.models===1&&w.objects===0&&w.actorStyle==='mmd'&&w.shadows),JSON.stringify(report.windows.map(w=>[w.scenery,w.models,w.objects,w.actorStyle,w.shadows])));
  return {shadows,restoration,parallax,exposure,highlights,nurse,room,reported:{samples:diag.targetSamples,hz:diag.refreshRate,foveation:diag.foveation,eyes:report.eyeViewports}};
};
