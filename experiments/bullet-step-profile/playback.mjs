import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cpus, release} from 'node:os';
import {Matrix4, PerspectiveCamera, Scene, Vector3} from 'three';
import {createCustomBulletMmdPhysicsBackend} from '@yohawing/three-mmd-loader/physics';
import {loadNodeBulletStage} from '../../scripts/node-bullet-stage.mjs';
import {createLedger} from './ledger.mjs';
import {createProfiledModule, phases, probeOptions, profileBulletDir} from './module.mjs';
import {solverBins, solverTotals} from './solver.mjs';
import {rowBinNames} from './row-loops.mjs';
import {passReport,kinds} from './joint-counts.mjs';
import {costReport} from './joint-costs.mjs';
import {genericTarget} from './joint-direct.mjs';

const [model, motion, ...flags] = process.argv.slice(2);
assert(model && motion && flags.every(f=>['--reverse','--solver','--rows','--smoke','--joint-counts','--joint-costs','--stand','--held','--joint-target','--joint-direct'].includes(f)),
  'Supply local PMX, body VMD [--solver|--rows|--joint-counts|--joint-costs|--joint-target|--joint-direct] [--stand|--held] [--smoke] [--reverse]');
assert(!(flags.includes('--stand') && flags.includes('--held')));
const workload=flags.includes('--stand')?'standing':flags.includes('--held')?'thighCradle':'dance';
const opts=probeOptions(flags), {rowLoops,solver,joints}=opts, reverseFlag = flags.includes('--reverse'), smoke=flags.includes('--smoke');
const dispatch=flags.includes('--joint-target')?'audit':flags.includes('--joint-direct')?'direct':undefined;
assert(!(dispatch && (solver || flags.filter(f=>['--joint-target','--joint-direct'].includes(f)).length!==1)));
const inspectInputs=rowLoops || !!joints || !!dispatch;
const pmx = new File([readFileSync(model)], 'actor.pmx'), vmd = workload==='dance' && new File([readFileSync(motion)], 'body.vmd');
const order = reverseFlag ? [1,0] : [0,1], frames=smoke?6:24, warm=smoke?2:4, blocks=smoke?4:24;
const camera = new PerspectiveCamera(), park = new Matrix4().makeTranslation(0,-1000,0);
const controllers = [park,park], hands = Array(12).fill(park), props = Array(8).fill(park);
const ledger = dispatch ? null : createLedger(opts), profile = await createProfiledModule(ledger?.mark,{...opts,dispatch});
const allPasses=[];
let identicalTransformWrites=0;
let building, measured = false;
const rows = [];
const {createMmdRuntimeHandle, close} = await loadNodeBulletStage((base, options) => {
  const row = building, m = row.profile ? profile : base;
  // Capture the live world at creation, outside any playback measurements.
  const create = m._mmd_anim_bullet_world_create;
  m._mmd_anim_bullet_world_create = out => {
    const status = create(out); assert.equal(status,0); row.world=m.HEAPU32[out>>>2]; return status;
  };
  if (dispatch) {
    // Fixed-size input tape, no per-call allocation in the timed replay. The
    // two tapes are compared outside the windows. Body writes precede world_step.
    const set=m._mmd_anim_bullet_world_set_rigidbody_transform;
    m._mmd_anim_bullet_world_set_rigidbody_transform=(world,index,pos,rot)=>{
      if(measured){const a=row.tape,u=m.HEAPU32,p=pos>>>2,q=rot>>>2,i=row.used;
        a[i]=index; for(let j=0;j<3;j++)a[i+1+j]=u[p+j]; for(let j=0;j<4;j++)a[i+4+j]=u[q+j]; row.used+=8;}
      return set(world,index,pos,rot);
    };
  } else if (joints) {
    const set=m._mmd_anim_bullet_world_set_rigidbody_transform;
    m._mmd_anim_bullet_world_set_rigidbody_transform=(world,index,pos,rot)=>{
      if(measured){const u=m.HEAPU32,p=pos>>>2,q=rot>>>2;
        row.fed.push(index,u[p],u[p+1],u[p+2],u[q],u[q+1],u[q+2],u[q+3]);}
      return set(world,index,pos,rot);
    };
  }
  if (inspectInputs) {
    const step=m._mmd_anim_bullet_world_step;
    m._mmd_anim_bullet_world_step=(world,dt,max,fixed)=>{
      if (measured) {row.stepArgs.push(dt,max,fixed); if(dispatch) row.tape[row.used++]=0xffffffff; else if(joints) row.fed.push(-1);}
      return step(world,dt,max,fixed);
    };
  }
  row.module = m;
  return row.native = createCustomBulletMmdPhysicsBackend(m, options);
}, profileBulletDir);
const {handContactShape,handReferenceRadius} = await import('../../src/mmdVrShowcase/xr/contact/handContactProfile.ts');
const {propColliderShape} = await import('../../src/mmdVrShowcase/play/propColliders.ts');
const sum = a => a.reduce((s,v)=>s+v,0), mean = a => sum(a)/a.length;
const ms = x => +x.toFixed(5), meanNs = ns => ms(ns/(frames*blocks*1e6));
const pct = (a,f) => a.toSorted((x,y)=>x-y)[Math.ceil(f*a.length)-1];
const snapshot = () => dispatch ? profile.jointTargetAudit?.() : ({total:ledger.totalNs, bins:[...ledger.bins], hist:{...ledger.histogram}, calls:ledger.calls,
  ...(joints==='costs' && {jointCosts:profile.jointCosts()}),
  ...(solver && {solverBins:[...ledger.solver.bins], solverCounts:[...ledger.solver.counts]}),
  ...(rowLoops && {rowBins:[...ledger.solver.rows.bins],rowCounts:[...ledger.solver.rows.counts],singles:ledger.solver.rows.singleIterations})});
function rowReport(before,n,parentNs) {
  const r=ledger.solver.rows, bins=r.bins.map((v,i)=>v-before.rowBins[i]);
  const partitionErrorNs=sum(bins)-parentNs; assert.equal(partitionErrorNs,0);
  return {exclusiveMs:Object.fromEntries(rowBinNames.map((name,i)=>[name,ms(bins[i]/n/1e6)])),
    nonemptyPasses:Object.fromEntries(rowBinNames.slice(1).map((name,i)=>[name,r.counts[i+1]-before.rowCounts[i+1]])),
    singleIterations:r.singleIterations-before.singles, partitionErrorNs};
}
function solverReport(before, n) {
  const bins=ledger.solver.bins.map((v,i)=>v-before.solverBins[i]);
  const counts=ledger.solver.counts.map((v,i)=>v-before.solverCounts[i]);
  const partitionErrorNs=sum(bins)-(ledger.bins[5]-before.bins[5]);
  assert.equal(partitionErrorNs,0); assert(counts[0]>0 && counts[1]>0, 'No solver data');
  assert(counts.slice(1).every(v=>v===counts[1]),'Incomplete solver batches');
  const avg=ns=>ms(ns/n/1e6);
  return {exclusiveMs:Object.fromEntries(solverBins.map((name,i)=>[name,avg(bins[i])])),
    phaseMs:Object.fromEntries(Object.entries(solverTotals(bins)).map(([name,ns])=>[name,avg(ns)])),
    solveCalls:counts[0], batches:counts[1], partitionErrorNs,
    ...(rowLoops && {rowLoops:rowReport(before,n,bins[5])}),
    ...(joints==='costs' && {jointCosts:costReport(before.jointCosts,profile.jointCosts(),n,bins[3])})};
}
// Coarse machine-wide busy fraction over the formal windows, including this
// process, checks and any concurrent work. Not an isolated CPU-time measure.
function hostSample() {
  const cores=cpus(), all=cores.map(c=>Object.values(c.times));
  return {utc:new Date().toISOString(), cpu:cores[0].model, logical:cores.length,
    total:sum(all.map(sum)), idle:sum(cores.map(c=>c.times.idle))};
}
const parity = {matrixScalars:0, morphWeights:0, vertices:0, contactSamples:0, maxContactPoints:0};
const va = new Vector3(), vb = new Vector3();
let initialWrist, wristTravel=0;
function comparePoses() {
  const [a,b] = rows.map(row => row.mesh);
  assert.equal(a.skeleton.bones.length,b.skeleton.bones.length);
  for (let i=0; i<a.skeleton.bones.length; i++) {
    const aa=a.skeleton.bones[i].matrixWorld.elements, bb=b.skeleton.bones[i].matrixWorld.elements;
    assert(aa.every((n,j)=>Number.isFinite(n) && n === bb[j]), 'Bone matrix differs'); parity.matrixScalars+=16;
  }
  const am=a.morphTargetInfluences??[], bm=b.morphTargetInfluences??[];
  assert(am.every(Number.isFinite)); assert.deepEqual(am,bm); parity.morphWeights+=am.length;
  const wrist=a.skeleton.bones.find(bone=>/^(右手首|rightwrist|righthand)$/i.test(bone.userData.mmdBoneName || bone.name));
  if (wrist) {
    va.setFromMatrixPosition(wrist.matrixWorld); initialWrist??=va.clone();
    wristTravel=Math.max(wristTravel,initialWrist.distanceTo(va));
  }
  const n=a.geometry.attributes.position.count, samples=Math.min(64,n);
  for (let j=0; j<samples; j++) {
    const i=Math.floor((j+(parity.contactSamples%8)/8)*n/samples); a.getVertexPosition(i,va); b.getVertexPosition(i,vb);
    assert(Number.isFinite(va.lengthSq()) && va.equals(vb), 'Skinned vertex differs'); parity.vertices++;
  }
  const [ca,cb]=rows.map(r=>r.native.debugPhysicsContacts());
  assert.deepEqual(ca,cb); parity.contactSamples++; parity.maxContactPoints=Math.max(parity.maxContactPoints,ca.length);
}

try {
  for (const index of order) {
    const row = building = rows[index] = {profile:!!index, frameMs:[], abiMs:[], blocks:[], stepArgs:[], fed:[]};
    row.rt = createMmdRuntimeHandle(new Scene(), {
      controllerColliders:()=>controllers, handColliders:()=>hands, handShape:handContactShape,
      handColliderRadius:()=>handReferenceRadius(.08), propColliders:()=>props, propShape:propColliderShape,
      onBulletStepWork(_feed,abiMs,_out,seed) {
        if (!measured) return;
        assert(!seed); row.abiMs.push(abiMs);
        if (row.profile && ledger) assert(ledger.last.ns/1e6 <= abiMs+0.001, 'Native call outside enclosing JS timer');
      },
    });
    const {modelId} = await row.rt.addModel(pmx,[],{physics:true,transform:{scale:.1}});
    if(vmd) {
      await row.rt.loadMotion(vmd,'body',modelId);
      assert(row.rt.duration > (warm+blocks)*frames/72, 'Motion too short for steady playback');
    } else if(workload==='thighCradle') {
      assert(row.rt.beginPose(modelId,0)?.applyPreset('thighCradle'),'Manual pose unavailable');
      row.rt.resetPhysics(0,modelId);
    }
    row.mesh=row.rt.getModelSurface(modelId).mesh;
  }
  let initial, hostStart;
  for (let block=-warm; block<blocks; block++) {
    if (block===0) {
      if(dispatch) for(const r of rows){
        const bodyCount=r.module._mmd_anim_bullet_world_get_rigidbody_count(r.world);
        r.tape=new Uint32Array(frames*(8*bodyCount+1)); r.used=0;
      }
      initial=snapshot(); if (inspectInputs) hostStart=hostSample();
    }
    for (const index of block%2 ? order.toReversed() : order) {
      const row=rows[index], first=row.abiMs.length, before=snapshot(); measured=block>=0;
      for (let i=0; i<frames; i++) {
        const frame=(block+warm)*frames+i, start=performance.now();
        row.rt.update(vmd?frame/72:0,true,camera,1,false,1/72);
        if (measured) row.frameMs.push(performance.now()-start);
      }
      const passes=row.profile && joints==='counts' ? profile.drainJointPasses() : undefined;
      if (measured) {
        assert.equal(row.abiMs.length-first, frames);
        if(ledger) assert.equal(ledger.calls-before.calls, row.profile ? frames : 0);
        const result={abiMs:ms(mean(row.abiMs.slice(first)))};
        if(dispatch) result.frameMs=ms(mean(row.frameMs.slice(first)));
        if(dispatch==='audit' && row.profile) result.jointCalls=profile.jointTargetAudit().jointCalls-before.jointCalls;
        if (row.profile && ledger) {
          result.nativeMs=ms((ledger.totalNs-before.total)/frames/1e6);
          result.phaseMs=Object.fromEntries(phases.map((k,i)=>[k,ms((ledger.bins[i]-before.bins[i])/frames/1e6)]));
          if (solver) result.solver=solverReport(before,frames);
          if(passes){
            const p=result.solver.jointPasses=passReport(passes,true);
            assert.equal(p.passes,result.solver.rowLoops.singleIterations);
            assert.equal(p.nonempty,result.solver.rowLoops.nonemptyPasses.jointRows);
            allPasses.push(...passes);
          }
        }
        row.blocks.push(result);
      }
      measured=false;
    }
    if(dispatch && block>=0){
      const [a,b]=rows; assert.equal(a.used,b.used); assert(a.used>frames && (a.used-frames)%8===0);
      assert(a.used<=a.tape.length && b.used<=b.tape.length,'Input tape overflow');
      assert.deepEqual(a.tape.subarray(0,a.used),b.tape.subarray(0,b.used),'Native body inputs differ');
      identicalTransformWrites+=(a.used-frames)/8; a.used=b.used=0;
    } else if(joints && block>=0){
      const [a,b]=rows.map(r=>r.fed);
      assert(a.length>frames && (a.length-frames)%8===0); assert.deepEqual(a,b,'Native body inputs differ');
      identicalTransformWrites+=(a.length-frames)/8; a.length=b.length=0;
    }
    comparePoses(); // deliberately outside timers
  }
  let environment, stepInputs;
  if (inspectInputs) {
    const end=hostSample(), start=hostStart;
    environment={platform:process.platform, release:release(), arch:process.arch, cpu:start.cpu, logical:start.logical,
      formalStartUtc:start.utc, formalEndUtc:end.utc, hostBusyPct:ms(100*(1-(end.idle-start.idle)/(end.total-start.total)))};
    const [a,b]=rows.map(r=>r.stepArgs);
    assert.equal(a.length,3*frames*blocks); assert.deepEqual(a,b,'Per-call timing inputs differ from baseline');
    const settings=new Set();
    for (let i=0;i<a.length;i+=3) settings.add(JSON.stringify(a.slice(i,i+3)));
    stepInputs={identicalCalls:a.length/3,dtMaxFixed:Array.from(settings,s=>JSON.parse(s))};
    if(joints || dispatch) stepInputs.identicalTransformWrites=identicalTransformWrites;
  }
  let native;
  if(ledger) {
    const hist=Object.fromEntries(Object.entries(ledger.histogram).map(([k,v])=>[k,v-(initial.hist[k]??0)]));
    const bins=ledger.bins.map((ns,i)=>ns-initial.bins[i]), total=ledger.totalNs-initial.total;
    assert.equal(sum(bins),total); assert.equal(sum(Object.values(hist)),frames*blocks);
    native={hist,actualSubsteps:sum(Object.entries(hist).map(([n,v])=>+n*v)),stepSimulationMs:meanNs(total),
      phaseMs:Object.fromEntries(phases.map((k,i)=>[k,meanNs(bins[i])])),partitionErrorNs:sum(bins)-total};
  }
  const counts=rows.map(r=>({bodies:r.module._mmd_anim_bullet_world_get_rigidbody_count(r.world),
    dynamic:r.rt.getDynamicRigidBodyCount(), joints:r.module._mmd_anim_bullet_world_get_constraint_count(r.world)}));
  assert.deepEqual(counts[0],counts[1]); assert(counts[0].dynamic>0 && counts[0].joints>0 && parity.maxContactPoints>0);
  assert(!vmd || !initialWrist || wristTravel>1e-6,'Wrist did not move; check motion binding');
  const solverSummary=solver ? solverReport(initial,frames*blocks) : undefined;
  if (solver) assert.equal(solverSummary.solveCalls,native.actualSubsteps);
  if(joints==='counts') solverSummary.jointPasses={...passReport(allPasses),patternFields:['iteration','visited','explicitVisits',...kinds.map(k=>'solved.'+k),...kinds.map(k=>'skipped.'+k)]};
  const abiDelta=rows[1].blocks.map((b,i)=>b.abiMs-rows[0].blocks[i].abiMs).toSorted((a,b)=>a-b);
  let jointDispatch;
  if(dispatch) {
    jointDispatch={mode:dispatch,...genericTarget};
    if(dispatch==='audit'){
      const a=profile.jointTargetAudit(); assert.equal(a.jointFirst,genericTarget.tableSlot,'Unexpected actual generic target');
      assert.equal(a.jointDifferent,0,'Joint dispatch target varied'); assert(a.jointCalls>initial.jointCalls);
      Object.assign(jointDispatch,{observedSlot:a.jointFirst,different:a.jointDifferent,formalCalls:a.jointCalls-initial.jointCalls});
    } else {
      const paired=key=>{const d=rows[1].blocks.map((b,i)=>b[key]-rows[0].blocks[i][key]).sort((a,b)=>a-b);
        return {medianDeltaMs:ms((d[(blocks-1)>>1]+d[blocks>>1])/2),wins:d.filter(x=>x<0).length,pairs:blocks};};
      Object.assign(jointDispatch,{pairedAbi:paired('abiMs'),pairedFrame:paired('frameMs')});
    }
  }
  console.log(JSON.stringify({node:process.version, workload, environment, stepInputs, reverse:reverseFlag, smoke, frames,warm,blocks, ...counts[0],
    bones:rows[0].mesh.skeleton.bones.length, poseSecondsPerFrame:vmd?1/72:0, fixedSeconds:1/60, ...native,
    parity,wristTravel:initialWrist?wristTravel:null,jointDispatch,solver:solverSummary, medianPairedAbiDeltaMs:ms((abiDelta[(blocks-1)>>1]+abiDelta[blocks>>1])/2),
    rows:rows.map(r=>({...(dispatch ? {variant:r.profile?dispatch:'original'} : {profile:r.profile}), calls:r.abiMs.length,
      frameMs:ms(mean(r.frameMs)), frameP95Ms:ms(pct(r.frameMs,.95)), abiMs:ms(mean(r.abiMs)), blocks:r.blocks})),
  },null,2));
} finally { for (const r of rows) r?.rt?.dispose(); close(); }
