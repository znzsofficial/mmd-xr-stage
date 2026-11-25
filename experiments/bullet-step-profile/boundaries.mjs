import assert from 'node:assert/strict';
import {createLedger} from './ledger.mjs';
import {createProfiledModule} from './module.mjs';

// Small correctness smoke, not a performance run. The C status is 0 in each
// successful case regardless of how many fixed substeps Bullet actually ran.
const rowLoops = process.argv.includes('--rows'), solver = rowLoops || process.argv.includes('--solver');
const ledger = createLedger({solver,rowLoops}), m = await createProfiledModule(ledger.mark,{solver,rowLoops});
const ptr = m._malloc(4);
assert.equal(m._mmd_anim_bullet_world_create(ptr), 0);
const world = m.HEAPU32[ptr >>> 2], step = (dt, max) => m._mmd_anim_bullet_world_step(world, dt, max, 1/64);
try {
  for (const [dt, max, substeps] of [[0, 3, 0], [1/64, 3, 1], [4/64, 2, 2]]) {
    assert.equal(step(dt, max), 0); assert.equal(ledger.last.stepCount, substeps);
  }
  assert.deepEqual(ledger.histogram, {0:1, 1:1, 2:1});
  assert.equal(ledger.bins.reduce((a,b)=>a+b), ledger.totalNs);
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
} finally { m._mmd_anim_bullet_world_destroy(world); m._free(ptr); }
