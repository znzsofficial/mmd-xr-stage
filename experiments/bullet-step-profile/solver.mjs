// Exclusive detail of the already measured solveConstraints bin. Turndown to
// the coarse probe is by omitting --solver, not by changing the simulated world.
import assert from 'node:assert/strict';

const SOLVE = 5, SETUP = 8, BODIES = 9, JOINTS = 10, CONTACTS = 11, ITER = 12, SPLIT = 13, FINISH = 14;
export const solverBins = ['dispatchAndGroup', 'setupOther', 'convertBodies', 'convertJoints', 'convertContacts',
  'iterationsExceptSplit', 'splitImpulseScope', 'finish'];
export const solverTotals = b => ({dispatchAndGroup:b[0], setup:b[1]+b[2]+b[3]+b[4], iterations:b[5]+b[6], finish:b[7]});

export function instrumentSolver({editFunction, entry, leave, once, mark}) {
  for (const [name,id] of [['solveGroupCacheFriendlySetup',SETUP], ['convertBodies',BODIES],
    ['convertJoints',JOINTS], ['solveGroupCacheFriendlyIterations',ITER],
    ['solveGroupCacheFriendlySplitImpulseIterations',SPLIT], ['solveGroupCacheFriendlyFinish',FINISH]]) {
    const open = entry(name);
    editFunction(open, fn => {
      assert(!fn.includes('return'), `Unexpected early exit from ${name}`);
      fn = once(fn, open, `${open}\n    ${mark(id)}`);
      fn = once(fn, leave, `${mark(-id)}\n    ${leave}`);
      if (id !== SETUP) return fn;
      // No BT_PROFILE in convertContacts. At the named Setup site verify the
      // entire consecutive virtual-call sequence against the pinned C++ body:
      // (bodies,n), (constraints,n), (manifolds,n), all with the same solverInfo.
      // Mark just the third call, not subsequent pool allocation/order setup.
      const call = 'call_indirect $T0 (type $t4)';
      const convert = (ptr,n,slot) => ['local.get $p0',`local.get $p${ptr}`,`local.get $p${n}`,'local.get $p7',
        'local.get $p0','i32.load',`i32.load offset=${slot}`,call].join('\n    ');
      const sequence = [convert(1,2,36),convert(5,6,32),convert(3,4,28)].join('\n    ');
      return once(fn, sequence, sequence.slice(0, -call.length) + `${mark(CONTACTS)}\n    ${call}\n    ${mark(-CONTACTS)}`);
    });
  }
}

// solveConstraints may dispatch multiple batches, including empty ones. Don't
// interpret a completed setup→iterate→finish triplet as an active island count.
export function createSolverLedger() {
  const bins = solverBins.map(()=>0), counts = solverBins.map(()=>0);
  let state = 0, expected, previous, started;
  const current = solverBins.map(()=>0);
  const bin = id => id === SOLVE ? 0 : id - SETUP + 1;
  const ledger = {bins, counts, totalNs:0, mark};
  function mark(event, now) {
    if (event === SOLVE) {
      assert.equal(state, 0); state=SOLVE; expected=SETUP; previous=started=now; current.fill(0); return;
    }
    assert(state, 'Solver scope outside solveConstraints');
    current[bin(state)] += now - previous; previous=now;
    if (event > 0) {
      assert.equal(event, expected, 'Unexpected solver scope order');
      state=event; counts[bin(state)]++;
      expected = state === SETUP ? BODIES : state === ITER ? SPLIT : -state;
      return;
    }
    assert.equal(-event,state,'Mismatched solver scope end');
    switch (state) {
      case BODIES: case JOINTS: case CONTACTS:
        expected=state===CONTACTS ? -SETUP : state+1; state=SETUP; break;
      case SPLIT: expected=-ITER; state=ITER; break;
      case SETUP: case ITER:
        assert.equal(expected,-state); expected=state===SETUP ? ITER : FINISH; state=SOLVE; break;
      case FINISH: expected=SETUP; state=SOLVE; break;
      case SOLVE: {
        assert.equal(expected,SETUP, 'Incomplete solver batch');
        const ns=now-started;
        assert.equal(current.reduce((a,b)=>a+b),ns,'Solver sub-bins do not partition solveConstraints');
        for (let i=0; i<bins.length; i++) bins[i]+=current[i];
        counts[0]++; ledger.totalNs+=ns; state=0; break;
      }
    }
  }
  return ledger;
}
