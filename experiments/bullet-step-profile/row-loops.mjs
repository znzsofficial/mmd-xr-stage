// Pinned btSequentialImpulseConstraintSolver::solveSingleIteration. Time a
// complete nonempty pass, never the shared generic/lower-limit row primitive.
import assert from 'node:assert/strict';

const SINGLE = 15, JOINT = 16, TYPED = 17, INTERLEAVED = 18, CONTACT = 19, FRICTION = 20, ROLLING = 21;
export const rowBinNames = ['controlAndGuards', 'jointRows', 'obsoleteTypedConstraints',
  'interleavedContactFriction', 'contactRows', 'frictionRows', 'rollingFrictionRows'];

export function instrumentRowLoops({editFunction, entry, leave, once, mark}) {
  const open = entry('solveSingleIteration');
  editFunction(open, fn => {
    assert(!fn.includes('return'));
    fn = once(fn, open, `${open}\n    ${mark(SINGLE)}`);
    fn = once(fn, leave, `${mark(-SINGLE)}\n    ${leave}`);
    // The first three loops are order randomization and are deliberately unmarked.
    assert.deepEqual([...fn.matchAll(/^ +loop \$L(\d+)$/gm)].map(m=>+m[1]), [3,7,10,13,17,21,24,25,27]);
    // Check both endpoints against the structured loop, the entry guard, and
    // the table dispatches inside it. Early branches must land inside the pass.
    function pass(id, label, index, guard, loads, indirect) {
      const match = fn.match(new RegExp(`^( +)loop \\$L${label}$`,'m'));
      assert(match); const indent = match[1], lines = parts => parts.join('\n' + indent);
      const pre = lines(['i32.const 0', `local.set $p${index}`, `loop $L${label}`]);
      const a = fn.indexOf(pre), endToken = `\n${indent}end\n`, b = fn.indexOf(endToken,match.index) + endToken.length - 1;
      assert(a>=0 && b>match.index && fn.slice(0,a).trimEnd().endsWith(guard));
      const body = fn.slice(a,b);
      assert(body.trimEnd().endsWith(`br_if $L${label}\n${indent}end`));
      for (const offset of loads) assert(body.includes(`i32.load offset=${offset}\n`));
      assert.deepEqual([...body.matchAll(/i32.load offset=(\d+)\s+call_indirect \$T0 \(type \$t(\d+)\)/g)].map(m=>[+m[1],+m[2]]), indirect);
      for (const [,target] of body.matchAll(/\bbr(?:_if)? \$(\w+)/g))
        assert(body.includes(`loop $${target}\n`) || body.includes(`block $${target}\n`));
      fn = once(fn,body,`${mark(id)}\n${indent}${body}\n${indent}${mark(-id)}`);
    }
    pass(JOINT,13,3,'if $I12',[56,136],[[212,10]]); // non-contact pool + order; override guard
    pass(TYPED,17,3,'if $I16',[28,32],[[24,11]]); // enabled typed constraint, getOrInitSolverBody x2
    pass(INTERLEAVED,21,2,'local.set $p3',[36,116,76,156],[[216,10],[212,10],[212,10]]);
    pass(CONTACT,24,3,'if $I23',[36,116],[[216,10]]); // contact + contact order, lower-limit solver
    pass(FRICTION,25,2,'br_if $B19',[36,76,156,140],[[212,10]]); // frictionIndex -> normal impulse
    pass(ROLLING,27,2,'br_if $B15',[36,96,140],[[212,10]]); // rolling pool, no order array
    return fn;
  });
}

// Independent partition of iterationsExceptSplit. The single-iteration scope
// validates branch order but contributes no extra bin; guards, shuffle, empty
// pools, stopping tests and iteration dispatch stay with controlAndGuards.
export function createRowLedger() {
  const bins=rowBinNames.map(()=>0), counts=rowBinNames.map(()=>0);
  const ledger={bins,counts,singleIterations:0,begin,end,mark};
  let current, previous, single, lastPass, passedInterleaved;
  function begin(now) { assert.equal(current,undefined); current=0; previous=now; }
  function charge(now) { bins[current]+=now-previous; previous=now; }
  function end(now) { assert.equal(current,0); assert(!single); charge(now); current=undefined; }
  function mark(event,now) {
    assert.notEqual(current,undefined); charge(now);
    if (Math.abs(event)===SINGLE) {
      assert.equal(current,0); assert.equal(!!single,event<0);
      single=event>0;
      if (single) { ledger.singleIterations++; lastPass=SINGLE; passedInterleaved=false; }
    } else if (event>0) {
      assert(single && event>lastPass && event<=ROLLING); assert.equal(current,0);
      if (event===INTERLEAVED) passedInterleaved=true;
      else if (event===CONTACT || event===FRICTION) assert(!passedInterleaved);
      lastPass=event; current=event-SINGLE; counts[current]++;
    } else {
      assert(single && current>0); assert.equal(current,-event-SINGLE); current=0;
    }
  }
  return ledger;
}
