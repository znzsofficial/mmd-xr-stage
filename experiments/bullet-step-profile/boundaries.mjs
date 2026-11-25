import assert from 'node:assert/strict';
import {createLedger} from './ledger.mjs';
import {createProfiledModule,probeOptions} from './module.mjs';
import {passReport} from './joint-counts.mjs';
import {costReport} from './joint-costs.mjs';

// Small correctness smoke, not a performance run. The C status is 0 in each
// successful case regardless of how many fixed substeps Bullet actually ran.
const options=probeOptions(process.argv.slice(2)), {rowLoops,solver,joints}=options;
const ledger = createLedger(options), m = await createProfiledModule(ledger.mark,options);
const start=m.jointCosts?.();
const ptr = m._malloc(4);
assert.equal(m._mmd_anim_bullet_world_create(ptr), 0);
const world = m.HEAPU32[ptr >>> 2], step = (dt, max) => m._mmd_anim_bullet_world_step(world, dt, max, 1/64);
try {
  for (const [dt, max, substeps] of [[0, 3, 0], [1/64, 3, 1], [4/64, 2, 2]]) {
    assert.equal(step(dt, max), 0); assert.equal(ledger.last.stepCount, substeps);
  }
  assert.deepEqual(ledger.histogram, {0:1, 1:1, 2:1});
  assert.equal(ledger.bins.reduce((a,b)=>a+b), ledger.totalNs);
  if(joints==='counts') {
    const passes=passReport(m.drainJointPasses()); assert.equal(passes.passes,ledger.solver.rows.singleIterations);
    assert.equal(passes.visits,0); assert.equal(passes.executed,0);
  }
  if(joints==='costs') {
    const c=costReport(start,m.jointCosts(),ledger.calls,ledger.solver.bins[3]);
    for(const k of ['info1','info2']) assert.equal(c[k].calls+c[k].passNs,0);
  }
  if (solver) {
    assert.equal(ledger.solver.counts[0],3); // zero + one + two actual substeps
    assert.equal(ledger.solver.bins.reduce((a,b)=>a+b),ledger.bins[5]);
    if (rowLoops) {
      assert.equal(ledger.solver.rows.bins[0],ledger.solver.bins[5]);
      assert(ledger.solver.rows.counts.every(n=>n===0),'Empty world ran a nonempty row pass');
    }
  }
  const before = ledger.calls;
  assert.notEqual(step(-1, 3), 0);
  assert.equal(m._mmd_anim_bullet_world_reset(world), 0);
  assert.equal(m._mmd_anim_bullet_world_settle_to_current(world), 0);
  assert.equal(ledger.calls, before, 'Input rejection/reset/settle counted as simulation');
  console.log('OK: empty world, 0/1/clamped 2 substeps, exact ns partition, invalid/reset/settle outside timer.');
  if(joints==='counts') verifyOverrideFixture(m,world,ptr,step);
} finally { m._mmd_anim_bullet_world_destroy(world); m._free(ptr); }

// Exercise a branch the PMX C importer cannot request. Only this disposable
// two-joint fixture asks for two EXTRA iterations on one joint; the other
// keeps the normal ten. Check the Census records against that known split.
function verifyOverrideFixture(m,world,out,step) {
  const d=m._malloc(128), u=m.HEAPU32, f=m.HEAPF32, at=d>>>2;
  try {
    for(let i=0;i<3;i++) {
      u.fill(0,at,at+32); f[at+1]=.1; f[at+4]=i; f[at+10]=i?1:0;
      assert.equal(m._mmd_anim_bullet_world_add_rigidbody(world,d,out),0); assert.equal(u[out>>>2],i);
    }
    for(let i=0;i<2;i++) {
      u.fill(0,at,at+32); u[at]=i; u[at+1]=i+1; f[at+2]=i+.5; f.fill(1,at+20,at+26);
      assert.equal(m._mmd_anim_bullet_world_add_6dof_spring_joint(world,d,out),0); assert.equal(u[out>>>2],i);
    }
    // Pinned C binding get_constraint_count reads (end - begin)/4 at 36/32.
    // convertJoint reads btTypedConstraint::m_overrideNumSolverIterations at 24.
    assert.equal(m._mmd_anim_bullet_world_get_constraint_count(world),2);
    const begin=u[(world+32)>>>2]; assert.equal(u[(world+36)>>>2]-begin,8);
    const field=(u[begin>>>2]+24)>>>2; assert(m.HEAP32[field]<=0); u[field]=12;
    f.set([1.1,.1,.1,0,0,0,1],at);
    assert.equal(m._mmd_anim_bullet_world_set_rigidbody_transform(world,1,d,d+12),0);
    assert.equal(step(1/64,1),0);
    const passes=m.drainJointPasses().filter(p=>p[1]); assert.equal(passes.length,12,JSON.stringify(passes));
    for(const [i,p] of passes.entries()) {
      const report=passReport([p]); assert.equal(p[0],i); assert.equal(report.visits,12);
      assert.equal(report.explicitVisits,6); assert.equal(report.executed,i<10?12:6); assert.equal(report.skipped,i<10?0:6);
    }
    console.log('OK: two synthetic 6DOF joints, 10 inherited / 12 explicit: 12 visited each pass, last two solve 6 / skip 6.');
  } finally {m._free(d);}
}
