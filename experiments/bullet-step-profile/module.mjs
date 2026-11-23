// Offline instrumentation for the shipped 0.8.6 WASM only. No generated files.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import wabtFactory from 'wabt';
import {createNodeBulletModule} from '../../scripts/node-bullet-stage.mjs';

export const phases = ['other', 'updateAabbs', 'calculateOverlappingPairs', 'dispatchAllCollisionPairs', 'calculateSimulationIslands', 'solveConstraints'];
export const ROOT = 6, SUBSTEP = 7;
const wasmUrl = new URL('../../public/mmd/0.8.6/mmd_bullet.wasm', import.meta.url);

// Pinned artifact: the default btQuickprof callbacks are no-ops, but the
// named enter/leave sites survive -O3. Mark only five scopes, never each pair
// or solver iteration. WABT's named round trip preserves all original calls.
function instrument(wat, raw) {
  const enter = 'i32.const 17292\n    i32.load\n    call_indirect $T0 (type $t0)';
  const leave = 'i32.const 17296\n    i32.load\n    call_indirect $T0 (type $t8)';
  const mark = id => `i32.const ${id}\n    call $stageMark`;
  function once(text, needle, replacement) {
    assert.equal(text.split(needle).length, 2, `Expected unique ${needle}`);
    return text.replace(needle, () => replacement);
  }
  function editFunction(needle, edit) {
    const at = wat.indexOf(needle);
    assert(at >= 0 && at === wat.lastIndexOf(needle), `Missing/ambiguous site: ${needle}`);
    const start = wat.lastIndexOf('\n  (func ', at), end = wat.indexOf('\n  (', at + needle.length);
    assert(start >= 0 && end > start);
    wat = wat.slice(0, start) + edit(wat.slice(start, end)) + wat.slice(end);
  }
  function entry(name) {
    // Address in the first active data segment of this digest (base 1024).
    const loc = raw.indexOf(name + '\0');
    assert(loc > 334517 && raw.indexOf(name + '\0', loc + 1) === -1);
    return `i32.const ${1024 + loc - 334517}\n    ${enter}`;
  }

  wat = once(wat, '  (import "a" "a"', '  (import "stage" "mark" (func $stageMark (type $t0)))\n  (import "a" "a"');
  // The C binding validates arguments, calls exactly one virtual stepSimulation,
  // drops the solver return value, then clears g_last_error. Time only that call.
  editFunction('local.tee $p0\n    local.get $p1\n    local.get $p2\n    local.get $p3\n    local.get $p0\n    i32.load\n    i32.load offset=56\n    call_indirect $T0 (type $t35)', fn => {
    assert(fn.includes('(func $l (type $t35)'));
    const call = 'call_indirect $T0 (type $t35)';
    return once(fn, call, `${mark(ROOT)}\n    ${call}\n    ${mark(-ROOT)}`);
  });
  const sub = entry('internalSingleStepSimulation');
  wat = once(wat, sub, `${sub}\n    ${mark(SUBSTEP)}`);
  for (let id = 1; id < phases.length; id++) {
    const open = entry(phases[id]);
    editFunction(open, fn => {
      assert(!fn.includes('return'), 'Unexpected early exit');
      // Narrow-phase dispatch is the inner of two consecutively closing scopes
      // in performDiscreteCollisionDetection. The solver contains nested marks;
      // its own scope closes last. AABBs, pairs and islands close exactly once.
      let end;
      if (phases[id] === 'dispatchAllCollisionPairs') {
        assert(fn.includes(entry('performDiscreteCollisionDetection')));
        assert(fn.includes(`${leave}\n    ${leave}`));
        end = fn.indexOf(leave);
      } else {
        end = fn.lastIndexOf(leave);
        if (phases[id] !== 'solveConstraints') assert.equal(end, fn.indexOf(leave));
      }
      assert(end > fn.indexOf(open));
      return once(fn.slice(0, end), open, `${open}\n    ${mark(id)}`) + `${mark(-id)}\n    ` + fn.slice(end);
    });
  }
  return wat;
}

export async function createProfiledModule(mark) {
  const raw = readFileSync(wasmUrl);
  assert.equal(createHash('sha256').update(raw).digest('hex'), '02e32a4c9ec3b16d166feec06edc20cf689be9a60e3286f2048c3c02392bebc9');
  const wabt = await wabtFactory(), input = wabt.readWasm(raw, {});
  let patched;
  try {
    input.generateNames(); input.applyNames();
    const wat = input.toText({foldExprs:false, inlineExport:false});
    // Confirm the unedited round trip reproduces every code/data byte. WABT
    // omits the redundant data-count section [12,1,5] for this artifact.
    const plain = wabt.parseWat('plain.wat', wat);
    try {
      assert.deepEqual([...raw.subarray(2058,2061)], [12,1,5]);
      assert(Buffer.from(plain.toBinary({}).buffer).equals(Buffer.concat([raw.subarray(0,2058),raw.subarray(2061)])));
    } finally { plain.destroy(); }
    patched = wabt.parseWat('profile.wat', instrument(wat, raw));
    patched.validate();
    const compiled = new WebAssembly.Module(patched.toBinary({}).buffer);
    return await createNodeBulletModule({instantiateWasm(imports, ready) {
      ready(new WebAssembly.Instance(compiled, {...imports, stage:{mark}}), compiled);
    }});
  } finally { patched?.destroy(); input.destroy(); }
}
