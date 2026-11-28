// node scripts/webgpu-actor/compile-stage.cjs <isolated-product-root> <local-fixtures.json> <local-output-directory> [--hands <local-hand-plan.json>]
// fixtures: {pmx,vmd,plan?}. No model paths or filenames in the report.
// For a baseline extract tracked product sources (git archive <rev>) and use
// its matching node_modules, rather than serving a concurrently edited tree.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const {createHash}=require('node:crypto');
const {install}=require('./compile-probe.cjs');

function once(source,needle,replace){
  assert.equal(source.split(needle).length,2,'Update the test harness adapter: '+needle);
  return source.replace(needle,()=>replace);
}

function summarize(r){
  const methods={},compute={},raw=r.events;
  for(const {method,entry} of raw){methods[method]=(methods[method]??0)+1;if(entry)compute[entry]=(compute[entry]??0)+1;}
  return {label:r.label,drawnPairWallMs:r.firstDraw.sinceRelease,completePairWallMs:r.firstReady.sinceRelease,
    readbackWallMs:r.readbackWallMs,callbacks:r.frames.length,slowestCompletionIntervalMs:Math.max(...r.frames.map(f=>f.interval)),
    maxCallbackWorkMs:Math.max(...r.frames.map(f=>f.work)),maxTrackedIntervalMs:r.maxTrackedIntervalMs,eye:r.extent,methods,compute,
    newPipelineObjects:new Set(raw.map(e=>e.pipeline).filter(Boolean)).size,distinctWgsl:new Set(raw.map(e=>e.source).filter(Boolean)).size,
    totalSyncApiWallMs:raw.reduce((v,e)=>v+e.js,0),maxAsyncApiWallMs:Math.max(0,...raw.filter(e=>e.done!=null&&(e.method.endsWith('Async')||e.method==='getCompilationInfo')).map(e=>e.done-e.at))};
}

async function run({page,ids,click,aim,trigger,until,bButton,frames,target,idleRay,pickMounted,placeFromBag,first,second,inputs,out,hands,sites}){
  const report={description:'One hardware GPU; simulated XR; fresh page; all times wall ms. First ready includes two actually submitted projection slices, and every expected actor drawn. Placement additionally requires ready GPU cloth on both. Style requires requested material mode; VMD held and physics off.',steps:[]};
  const raw={};
  const save=()=>{
    fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(report,null,2));
    fs.writeFileSync(path.join(out,'events.json'),JSON.stringify(raw,null,2));
  };
  const quiet=async()=>{await target({name:'watch:quiet'});await idleRay();await frames(3);};
  const arm=spec=>page.evaluate(s=>compileProbe.arm(s),spec);
  const snapshot=(name,omit=null)=>page.evaluate(([n,id])=>compileProbe.capture(n,id),[name,omit]);
  const compare=(base,omit,a,b)=>page.evaluate(s=>compileProbe.compare(s),{base,omit,a,b});
  async function result(label){
    await page.waitForFunction(()=>compileProbe.pending(),null,{timeout:90000});
    const r=await page.evaluate(()=>compileProbe.report());assert.equal(r.label,label);raw[label]=r;
    const row=summarize(r);report.steps.push(row);console.log(JSON.stringify(row));save();
  }
  report.hardware=await page.evaluate(()=>labFixture.adapters);
  assert(report.hardware.some(a=>a.xrCompatible)&&report.hardware.every(a=>a.vendor&&!a.fallback&&!/software|warp|llvmpipe|swiftshader/i.test(JSON.stringify(a))));
  report.browser=await page.evaluate(()=>navigator.userAgent);report.fixtureSha256={};
  for(const k of ['pmx','vmd'])report.fixtureSha256[k]=createHash('sha256').update(fs.readFileSync(inputs[k])).digest('hex');
  await page.evaluate(()=>compileProbe.observeRenderer());

  await placeFromBag(second,[0,0,-1.85],0,0,{label:'place1',count:1});await result('place1');
  const actor=await until('first actor GPU cloth',(s)=>s.selected&&s.physics&&s.actor?.mode==='gpu'&&s.actor.clothSteps>1);
  await click('hudDone');await quiet();
  await placeFromBag(first,[.98,0,-2.1],1,1,{label:'place2',count:2});await result('place2');
  const pair=await until('both actors use independent drivers',(s)=>s.live===2&&s.actor?.actors.every(a=>a.mode==='gpu'&&a.visible));
  const other=pair.actor.actors.find(a=>a.id!==actor.runtimeId).id;
  await click('hudDone');await quiet();
  // Turn off both solvers only after sampling both independent cloth drivers.
  await bButton();await click('hudMore');await click('settingsCharacter');await click('settingsMmdVrPhysicsOn');
  await until('physics held for image controls',s=>s.ready&&!s.physics);await click('hudBack');await quiet();
  await pickMounted(ids.model);await click('hudChangeMotion');await click('hudApplyBody');
  await until('original motion playing',s=>s.playing&&s.hasBinding&&s.time>.12);
  await bButton();await click('settingsMmdVrPause');
  const held=await until('same bound pose held',s=>s.ready&&!s.playing&&s.time>0&&s.hasBinding);report.heldTime=held.time;
  await quiet();await pickMounted(ids.model);await aim(await target({key:'actorStyleMmd'}));
  await snapshot('base');await snapshot('without1',actor.runtimeId);await snapshot('without2',other);
  for(const [label,mode,key] of [['endfield1','endfield','actorStyleEndfield'],['mmd','mmd','actorStyleMmd'],['endfield2','endfield','actorStyleEndfield']]){
    await aim(await target({key}));await trigger(true);await arm({label,mode,count:2,id:actor.runtimeId});await trigger(false);
    await result(label);
  }
  // Compare only pixels actually contributed by each PMX, on the first
  // completed pair of each switch. The other actor never switches materials.
  report.pixels={};
  for(const [name,a,b] of [['first','base','endfield1'],['restore','base','mmd'],['repeat','endfield1','endfield2'],['other','base','endfield1'],['otherRestored','base','mmd'],['otherRepeated','base','endfield2']]){
    report.pixels[name]=await compare('base',name.startsWith('other')?'without2':'without1',a,b);
  }
  raw.session=await page.evaluate(()=>compileProbe.totals());save();
  for(const row of Object.values(report.pixels))assert(row.every(v=>v.pixels>120),'Actor not seen in both eyes');
  assert(report.pixels.first.every(v=>v.changed>=100),'First switch missing from one eye');
  assert(report.pixels.restore.every((v,i)=>v.l1<report.pixels.first[i].l1*.2),'Failed original paint control');
  assert(report.pixels.repeat.every((v,i)=>v.l1<report.pixels.first[i].l1*.2),'Repeat switch did not restore style');
  assert(report.pixels.other.every(v=>v.changed<v.pixels*.02),'Second actor changed with first');
  await until('same held actor and clock after both switches',(s,p)=>s.hasBinding&&s.time===p.time&&s.runtimeId===p.id,{time:held.time,id:actor.runtimeId});
  await bButton(); await click('settingsMmdVrPlay');await until('same VMD resumes',(s,t)=>s.playing&&s.time>t+.05,held.time);
  await bButton();await click('settingsVrDesktopExit',{retiring:true});await until('empty retired room',s=>s.phase==='ended'&&!s.live);
  if(process.env.COMPILE_GPU_TIMING==='1'){
    report.webgpuFirstUse=await page.evaluate(async()=>{
      const {useLastPerformanceReport}=await import('/src/mmdVrShowcase/diagnostics/performanceReport.ts');
      return useLastPerformanceReport.getState().report?.webgpuFirstUse??[];
    });save();
  }
  if(sites){
    report.hands={};report.buffers={};
    async function checkBuffers(label,count){
      const sizes=await page.evaluate(()=>compileProbe.buffers());report.buffers[label]=sizes;save();
      assert(Object.keys(sizes).length===4 && Object.values(sizes).every(n=>n===count),label+': '+JSON.stringify(sizes));
    }
    await checkBuffers('first session ended',0);
    await page.locator('.stage-launch-row button.stage-btn-primary[data-xr-backend="webgpu"]').click();
    await until('fresh session on same page',s=>s.phase==='active'&&s.ready&&!s.live&&!s.hasBinding&&!!labSession.first);
    if(await page.evaluate(()=>!!gameTargets.find({key:'hudBack'})))await click('hudBack');await quiet();
    const before=(await page.evaluate(()=>stageProbe.read())).placeCommands;
    await placeFromBag(second,[0,0,-1.85],before);const firstActor=await until('first rested actor',s=>s.selected&&s.ready&&s.actor?.mode==='gpu');
    await click('hudDone');await quiet();
    await placeFromBag(first,[.98,0,-2.1],before+1,1);await until('two active garment drivers',s=>s.live===2&&s.ready&&s.actor?.mode==='gpu');
    await click('hudDone');await quiet();await checkBuffers('both actors live',2);
    const {trial}=require('./compile-hands.cjs');
    for(const [i,model] of [second,first].entries()){
      const runtimeId=await page.evaluate(n=>gameTargets.model(n).runtime,model);
      for(const name of ['empty','both'])await page.evaluate(trial(hands.trial),{name,sites,runtimeId});
      const {lift,pixels,grips}=await page.evaluate(hands.compare,false),l=lift.both;
      report.hands[model]={lift:l,pixels,grips};save();console.log('Actor '+(i+1)+' hands',JSON.stringify(l));
      assert.deepEqual(grips.both.withdrawLeft,['missing','grip']);assert(l.hold.every(v=>v>18)&&Math.abs(l.withdrawLeft[0])<14&&l.withdrawLeft[1]>18&&l.release.every(v=>Math.abs(v)<12));
      assert(pixels.both.every((eye,i)=>eye.every((v,j)=>v>10&&v>pixels.released[i][j]))&&pixels.withdraw.every(e=>e[1]>10));
      if(i===0){
        await pickMounted(ids.model);await click('watchArrange');await click('hudPutAway');
        await until('other actor keeps its solver after first is removed',s=>s.live===1&&s.ready&&s.actor?.mode==='gpu'&&!s.runtimeId);
        assert(firstActor.runtimeId===runtimeId);await checkBuffers('only second actor live',1);await quiet();
      }
    }
    await bButton();await click('settingsVrDesktopExit',{retiring:true});await until('second session retired',s=>s.phase==='ended'&&!s.live);await checkBuffers('second session ended',0);
    raw.afterSecondSession=await page.evaluate(()=>compileProbe.totals());
  }
  report.finished=true;save();console.log('Completed. First-pair pixels:',JSON.stringify(report.pixels));
}

exports.run=run;
if(require.main===module){
  const [productRoot,fixturePath,outPath,option,planPath]=process.argv.slice(2);
  assert(productRoot&&fixturePath&&outPath&&(!option||option==='--hands'),'Expected product root, private fixture JSON and output directory');
  const root=path.resolve(productRoot),inputs=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
  const out=path.resolve(outPath);fs.mkdirSync(out,{recursive:true});
  assert(!fs.existsSync(path.join(out,'summary.json')),'Choose a fresh output directory');
  const harness=path.join(root,'scripts/webgpu-actor/game-floor-smoke.cjs');
  let src=fs.readFileSync(harness,'utf8');
  // Extend the existing driver in memory. Do not add a new production entry,
  // write to the shared harness, or bypass the normal trigger/placement path.
  const shim=once(require(path.join(root,'scripts/webgpu-actor/xr-room-shim.cjs')).toString(),
    'stats.pending--; stats.frames++;','compileProbe.enter(); stats.pending--; stats.frames++;');
  const observed=once(shim,'if (take && pose && stats.submissions > before) take.afterDraw(s);',
    'if (take && pose && stats.submissions > before) take.afterDraw(s); compileProbe.after(s);');
  src=once(src,'(${extend})();','(${qa.observed})(); (${qa.install})();');
  if(process.env.COMPILE_GPU_TIMING==='1')src=once(src,"if(timing)href.searchParams.set('gpuTiming','1');","href.searchParams.set('gpuTiming','1');");
  src=once(src,'const shadowSources=',"await fs.copyFile(pmx,path.join(folder,first));\n    const shadowSources=");
  src=once(src,'before,live=0) {','before,live=0,measure) {');
  src=once(src,'await trigger(false);assert.equal((await read()).placeCommands,before+1);',
    'if(measure)await page.evaluate(s=>compileProbe.arm(s),measure);await trigger(false);assert.equal((await read()).placeCommands,before+1);');
  src=once(src,"'vite-game-floor-smoke'","'vite-compile-stage-'+"+JSON.stringify(createHash('sha256').update(root).digest('hex').slice(0,12)));
  src=once(src,'    if(timing){',`    await qa.run({page,ids,click,aim,trigger,until,bButton,frames,target,idleRay,pickMounted,placeFromBag,first,second,inputs:qa.inputs,out:qa.out,hands,sites});
    assert.deepEqual(errors,[]);assert.deepEqual(consoles.filter(x=>/shader|validation|wgsl|pipeline|nodebuilder/i.test(x)),[]);return;
    if(timing){`);
  src=once(src,'state:window.stageProbe?.read(),','state:window.stageProbe?.read(),probe:window.compileProbe?.debug(),');
  // Do not cost every pose a full 640px readback; the fixture's standard
  // 240px/eye is sufficient for before/after differences and the hand plan.
  process.argv=[process.execPath,harness,inputs.pmx,inputs.vmd,option?(planPath??inputs.plan):'--actor-style'];
  assert(process.argv.at(-1),'Missing two-site hand plan');
  Object.assign(exports,{inputs,out,observed,install});
  const mod=new Module(harness,module);mod.filename=harness;mod.paths=Module._nodeModulePaths(path.dirname(harness));
  mod._compile(`const qa=require(${JSON.stringify(__filename)});\n`+src,harness);
}
