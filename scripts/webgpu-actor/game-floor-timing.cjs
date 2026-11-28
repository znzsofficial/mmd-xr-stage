// Native WebGPU, fixed simulated stereo view. The GPU data comes only from
// the production JSON. Observe unchanged morph weights separately in the test.
const assert = require('node:assert/strict');

async function observe(duration) {
  const {scene,gl} = gameTargets.floorState(), id = stageProbe.read().runtimeId;
  let mesh;
  if (id) scene.traverse(node=>{if(node.userData.mmdModelId===id && node.userData.mmdTslSparsePositionMorphs)mesh=node;});
  const weights = mesh?.morphTargetInfluences;
  const previous = weights && new Float32Array(weights.length);
  const start = performance.now(), first = labSession.stats.frames;
  let unchanged = 0, computes = 0, unchangedComputeFrames = 0, frames = 0, before, sparseGroups=0, positionPasses=0;
  const submitted=[], native=gl.compute;
  gl.compute=function(group,...args){
    const result=native.call(this,group,...args);
    const firstNode=Array.isArray(group)?group[0]:group;
    if(firstNode.name?.startsWith('MMD sparse morph: '))sparseGroups++;
    if(firstNode.name==='MMD sparse morph: position')positionPasses++;
    return result;
  };
  // Only Three compute groups (including loader morph work) increment this
  // counter; cloth's native compute pass is measured by the production timer.
  try {await new Promise((done,fail)=>{
    const timeout=setTimeout(()=>{labFixture.take=null;fail(Error('No timing frame'));},30000);
    labFixture.take={inputs(){this.time=performance.now(); before=gl.info.compute.calls;},afterDraw(){
      const calls=gl.info.compute.calls-before;
      if (previous) {
        if (frames && previous.every((value,i)=>value===Math.fround(weights[i]))) {
          unchanged++; if(calls>0)unchangedComputeFrames++;
        }
        previous.set(weights);
      }
      computes+=calls;frames++;
      submitted.push([this.time,calls]);
      if(this.time-start>=duration){labFixture.take=null;clearTimeout(timeout);done();}
    }};
  });} finally {gl.compute=native;}
  const intervals=submitted.slice(1).map(([t],i)=>t-submitted[i][0]).sort((a,b)=>a-b);
  return {start,end:submitted.at(-1)[0],frames,callbacks:labSession.stats.frames-first,threeComputeCalls:computes,comparedMorphFrames:weights?frames-1:0,
    sameMorphFrames:unchanged,sameMorphFramesWithCompute:unchangedComputeFrames,vertices:mesh?.geometry.attributes.position.count??null,
    submitted,sparseGroups,positionPasses,visibleCallbackP95Ms:intervals[Math.ceil(intervals.length*.95)-1]??null};
}

module.exports = async function({page,click,until,bButton,target,idleRay,place}) {
  // Move all ordinary prep/interaction windows outside these two stable ranges.
  const empty=await page.evaluate(observe,7300);
  await place();
  await until('timing actor ready',s=>s.ready&&s.selected&&s.actor?.evaluations>1,null,120000);
  await click('hudChangeMotion');await click('hudApplyBody');
  await until('original MMD dance with GPU cloth and native body physics',s=>s.ready&&s.playing&&s.physics&&s.actor?.mode==='gpu'&&s.actor?.style?.mode==='mmd'&&s.time>.2);
  if(await page.evaluate(()=>!!gameTargets.find({key:'hudTools'})))await click('hudTools');
  if(await page.evaluate(()=>!!gameTargets.find({key:'hudDone'})))await click('hudDone');
  await target({name:'watch:quiet'});await idleRay();
  const dance=await page.evaluate(observe,7300);
  const adapters=await page.evaluate(()=>labFixture.adapters);
  assert(adapters.some(a=>a.xrCompatible)&&adapters.every(a=>a.vendor&&!a.fallback&&!/swiftshader|warp|software|llvmpipe/i.test(JSON.stringify(a))));
  await bButton();await click('settingsVrDesktopExit',{retiring:true});await until('timing run ended',s=>s.phase==='ended'&&!s.overlay);
  const report=await page.evaluate(async()=>{
    const {useLastPerformanceReport}=await import('/src/mmdVrShowcase/diagnostics/performanceReport.ts');return useLastPerformanceReport.getState().report;
  });
  assert.equal(report.backend,'webgpu');
  function summarize(windows,take){
    // Keep only complete observation windows, including their CPU averages.
    // The four GPU values still describe just the window-ending draw.
    const submitted=new Map(take.submitted);
    const rows=windows.filter(w=>w.gpuFrameTimeMs>=take.start+1100 && w.gpuFrameTimeMs<=take.end).map(w=>({at:w.stageClock?.timeMs??null,eyes:w.eyeViewports,samples:w.targetSamples,
      frameThreeComputeCalls:submitted.get(w.gpuFrameTimeMs),
      calls:w.drawCalls,modelCpuMean:w.modelUpdateCpuMs,callbackMean:w.frameIntervalMs,...w.gpuPasses}));
    assert(rows.length>=3,`Missing complete take windows: ${JSON.stringify(rows)}`);
    assert(rows.every(w=>w.status==='read' && Number.isFinite(w.stereoSceneMs) && Number.isFinite(w.stereoOutputMs)),`Incomplete stereo timestamps: ${JSON.stringify(rows)}`);
    for(const row of rows){
      assert(Number.isInteger(row.frameThreeComputeCalls),'Missing tracked callback for sample');
      if(row.frameThreeComputeCalls)assert(Number.isFinite(row.threeComputeMs),'Three compute submitted without a timestamp');
      else assert.equal(row.threeComputeMs,null,'Unexpected compute timestamp on a draw without a Three compute group');
    }
    delete take.submitted;
    return rows;
  }
  const emptyWindows=summarize(report.windows.filter(w=>w.gpuPasses&&!w.models),empty);
  const danceWindows=summarize(report.windows.filter(w=>w.gpuPasses&&w.models===1&&w.playing&&w.clothMode==='gpu'&&w.actorStyle==='mmd'),dance);
  // Cloth runs on its own fixed-step clock. An entire short take can hit
  // zero-step endpoints; report that coverage gap without inventing zero ms
  // or making a valid stereo/compute take fail.
  const clothWindows=danceWindows.filter(w=>w.clothSteps>0);
  assert(clothWindows.every(w=>Number.isFinite(w.clothMs)));
  assert(danceWindows.filter(w=>w.clothSteps===0).every(w=>w.clothMs===null));
  assert(dance.comparedMorphFrames>0);
  return {adapters,scenery:report.scenes,reportedHz:report.reportedRefreshRates,empty,emptyWindows,dance,danceWindows,
    clothTiming:{sampledDraws:clothWindows.length,zeroStepDraws:danceWindows.length-clothWindows.length}};
};
