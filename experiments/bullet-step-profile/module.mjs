// Offline instrumentation for two verified releases. Never patch a player asset.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import wabtFactory from 'wabt';
import {createNodeBulletModule} from '../../scripts/node-bullet-stage.mjs';
import {instrumentSolver} from './solver.mjs';
import {instrumentRowLoops} from './row-loops.mjs';
import {countDecl, instrumentJointCounts, drainJointPasses} from './joint-counts.mjs';
import {costDecl, costImport, instrumentJointCosts, costSnapshot} from './joint-costs.mjs';
import {patchJointDispatch} from './joint-direct.mjs';
import {patchIslandRange} from './island-range.mjs';

export const phases = ['other', 'updateAabbs', 'calculateOverlappingPairs', 'dispatchAllCollisionPairs', 'calculateSimulationIslands', 'solveConstraints'];
export const ROOT = 6, SUBSTEP = 7;
const artifacts = {
  '0.8.6': { digest: '02e32a4c9ec3b16d166feec06edc20cf689be9a60e3286f2048c3c02392bebc9', dataStart: 334517 },
  '0.9.0': { digest: 'b82107ac43d0ec79f9bc0a601ec6a773401e13d007bc4c9113e34f17e772b990', dataStart: 334576 },
};
export const profileBulletDir = version => new URL(`../../public/mmd/${version}/`, import.meta.url);

export function probeOptions(flags) {
  const counts=flags.includes('--joint-counts'), costs=flags.includes('--joint-costs');
  assert(!(costs && (counts || flags.includes('--rows'))),'Run joint costs separately from the row census');
  const rowLoops=counts || flags.includes('--rows');
  return {version:flags.includes('--0.9.0')?'0.9.0':'0.8.6',rowLoops,solver:costs || rowLoops || flags.includes('--solver'),joints:counts?'counts':costs?'costs':undefined};
}

// Pinned artifact: the default btQuickprof callbacks are no-ops, but the
// named enter/leave sites survive -O3. No host clock is read per solver row;
// the optional census counts inside WASM. The plain round trip is checked below.
function instrument(wat, raw, dataStart, solver, rowLoops, joints) {
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
    assert(loc > dataStart && raw.indexOf(name + '\0', loc + 1) === -1);
    return `i32.const ${1024 + loc - dataStart}\n    ${enter}`;
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
  if (solver) instrumentSolver({editFunction, entry, leave, once, mark});
  if (rowLoops) instrumentRowLoops({editFunction, entry, leave, once, mark});
  if (joints) {
    const memory='  (memory $d 1024 1024)';
    wat=once(wat,memory,memory+'\n  '+(joints==='counts'?countDecl:costDecl));
    if(joints==='counts') instrumentJointCounts({editFunction,entry,once});
    else {
      wat=once(wat,'  (import "stage" "mark"',`  ${costImport}\n  (import "stage" "mark"`);
      instrumentJointCosts({editFunction,entry,once});
    }
  }
  return wat;
}

export async function createProfiledModule(mark, {version='0.8.6', rowLoops=false, solver=rowLoops, joints, dispatch} = {}) {
  assert(!rowLoops || solver); assert(!joints || (solver && ['counts','costs'].includes(joints)));
  assert(!dispatch || !(mark || solver || rowLoops || joints),'A/B must not contain any timing marks');
  const dir = profileBulletDir(version), {digest, dataStart} = artifacts[version];
  const raw = readFileSync(new URL('mmd_bullet.wasm', dir));
  assert.equal(createHash('sha256').update(raw).digest('hex'), digest);
  assert.equal(raw.indexOf('out_contacts is null with non-zero capacity'), dataStart);
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
    const features={multi_memory:joints==='counts'};
    const source = dispatch === 'island-range' ? patchIslandRange(wat)
      : dispatch ? patchJointDispatch(wat,dispatch) : instrument(wat, raw, dataStart, solver, rowLoops,joints);
    patched = wabt.parseWat('profile.wat',source,features);
    patched.validate(features);
    const compiled = new WebAssembly.Module(patched.toBinary({}).buffer);
    if(dispatch && dispatch!=='audit') {
      const original=new WebAssembly.Module(raw);
      assert.deepEqual(WebAssembly.Module.imports(compiled),WebAssembly.Module.imports(original));
      assert.deepEqual(WebAssembly.Module.exports(compiled),WebAssembly.Module.exports(original));
    }
    let exports;
    const epoch=process.hrtime.bigint(), nowNs=()=>Number(process.hrtime.bigint()-epoch);
    const m=await createNodeBulletModule({instantiateWasm(imports, ready) {
      const instance=new WebAssembly.Instance(compiled,dispatch ? imports : {...imports, stage:{mark,nowNs}});
      exports=instance.exports; ready(instance,compiled);
    }}, dir);
    if(joints==='counts') m.drainJointPasses=()=>drainJointPasses(exports);
    if(joints==='costs') m.jointCosts=()=>costSnapshot(exports);
    if(dispatch==='audit') m.jointTargetAudit=()=>Object.fromEntries(['jointCalls','jointFirst','jointDifferent'].map(k=>[k,exports[k].value]));
    return m;
  } finally { patched?.destroy(); input.destroy(); }
}
