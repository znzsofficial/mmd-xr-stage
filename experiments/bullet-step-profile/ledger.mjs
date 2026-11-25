import assert from 'node:assert/strict';
import {ROOT, SUBSTEP, phases} from './module.mjs';
import {createSolverLedger} from './solver.mjs';

// Charge every interval between consecutive native marks to exactly one bin.
// 'other' is metered on the uncovered spans, not inferred from a JS outer timer.
export function createLedger({rowLoops=false, solver=rowLoops} = {}) {
  const epoch = process.hrtime.bigint();
  let start, previous, active, next, stepCount;
  let bins = phases.map(() => 0);
  const ledger = {calls:0, totalNs:0, bins:phases.map(() => 0), histogram:{}, last:null, mark};
  if (solver) ledger.solver = createSolverLedger(rowLoops);
  function mark(event) {
    const now = Number(process.hrtime.bigint() - epoch);
    if (event === ROOT) {
      assert.equal(start, undefined, 'Nested stepSimulation');
      previous = start = now; active = stepCount = next = 0; bins.fill(0);
      return;
    }
    if (start === undefined) return; // never count setup/teardown calls
    if (Math.abs(event) > SUBSTEP) {
      assert.equal(active, 5); ledger.solver.mark(event,now); return;
    }
    if (solver && Math.abs(event) === 5) ledger.solver.mark(event,now);
    bins[active] += now - previous; previous = now;
    if (event === -ROOT || event === SUBSTEP) {
      assert.equal(active, 0); assert.equal(next, stepCount ? phases.length : 0);
      if (event === SUBSTEP) { stepCount++; next = 1; return; }
      const ns = now - start;
      assert.equal(bins.reduce((a,b)=>a+b), ns, 'Unbalanced per-step partition');
      assert(ns >= 0 && bins.every(t => t >= 0));
      ledger.calls++; ledger.totalNs += ns;
       for (let i=0; i<bins.length; i++) ledger.bins[i] += bins[i];
      if (solver) assert.equal(ledger.solver.totalNs, ledger.bins[5]);
      ledger.histogram[stepCount] = 1 + (ledger.histogram[stepCount] ?? 0);
      ledger.last = {ns, stepCount}; start = undefined;
    } else if (event > 0) {
      assert.equal(active, 0, 'Overlapping categories'); assert.equal(event, next);
      active = event;
    } else {
      assert.equal(active, -event); active = 0; next++;
    }
  }
  return ledger;
}
