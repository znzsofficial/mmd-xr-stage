// Only the joint-row call site of this pinned artifact. Never reconstruct a
// solver or its arguments. The audit instance is separate from the timed A/B.
import assert from 'node:assert/strict';

export const genericTarget={tableSlot:407,watFunction:'$f312'};
const t='(type $t10)', indirect=`call_indirect $T0 ${t}`;
const choice=`local.tee $jointTarget i32.const ${genericTarget.tableSlot} i32.eq
          if ${t} call ${genericTarget.watFunction} else local.get $jointTarget ${indirect} end`;

export function patchJointDispatch(wat,mode) {
  assert(['audit','direct'].includes(mode));
  const unique=(s,n)=>{const i=s.indexOf(n);assert(i>=0 && i===s.lastIndexOf(n),`Missing/ambiguous: ${n}`);return i;};
  // A numeric index is an identity only for a private, unchanging table.
  unique(wat,'\n  (table $T0 501 501 funcref)\n');
  assert.equal((wat.match(/\(table /g)||[]).length,1); // no imported/exported table
  assert(!/\btable\.(set|init|copy|fill|grow)\b/.test(wat));
  const elements=[...wat.matchAll(/\(elem \$\w+ \(i32.const (\d+)\) func ([^\n)]+)\)/g)];
  assert.equal((wat.match(/\(elem /g)||[]).length,1); assert.equal(elements.length,1);
  const {tableSlot,watFunction}=genericTarget, [,base,entries]=elements[0];
  assert.equal(entries.split(' ')[tableSlot-Number(base)],watFunction);
  unique(wat,`(func ${watFunction} ${t} (param $p0 i32) (param $p1 i32) (param $p2 i32) (result f32)`);

  const guard='local.tee $p2\n        i32.load offset=136\n        local.get $p1\n        i32.gt_s\n        if $I14';
  const start=unique(wat,guard), loop=wat.lastIndexOf('loop $L13',start), end=wat.indexOf('br_if $L13',start);
  const body=wat.slice(loop,end);
  assert(body.includes('i32.const 152\n        i32.mul') && body.includes('i32.load offset=56') && body.includes('i32.load offset=136'));
  assert(body.includes('i32.load offset=144') && body.includes('i32.load offset=148'));
  assert.equal(body.match(/call_indirect/g)?.length,1);
  const call='i32.load offset=212\n          '+indirect;
  const at=loop+unique(body,call);
  const fn=wat.lastIndexOf('\n  (func ',loop); assert(wat.startsWith('\n  (func $f306 (type $t22)',fn));
  const locals=wat.indexOf('    (local ',fn); assert(locals>0 && locals<loop);
  let dispatch;
  if(mode==='audit') {
    // Leave the actual runtime target on-stack for the original indirect call.
    dispatch=`i32.load offset=212 local.tee $jointTarget
          global.get $jointCalls i32.eqz if local.get $jointTarget global.set $jointFirst end
          global.get $jointDifferent local.get $jointTarget global.get $jointFirst i32.ne i32.add global.set $jointDifferent
          global.get $jointCalls i32.const 1 i32.add global.set $jointCalls\n          ${indirect}`;
    const memory='(memory $d 1024 1024)'; unique(wat,memory); assert(wat.indexOf(memory)>at);
    wat=wat.replace(memory,memory+['jointCalls','jointFirst','jointDifferent'].map(k=>`\n  (global $${k} (export "${k}") (mut i32) (i32.const 0))`).join(''));
  } else {
    // Typed if takes the same three i32 operands already on the stack, and
    // leaves the same f32. Other targets (including traps) use the original
    // slot and table. Re-check each actual call, not just the start of a pass.
    dispatch=`i32.load offset=212 ${choice}`;
  }
  return wat.slice(0,locals)+'    (local $jointTarget i32)\n'+wat.slice(locals,at)+dispatch+wat.slice(at+call.length);
}

// Micro-check the exact typed branch used above with distinguishable callees.
// No Bullet world or PMX is modified just to make an alternate target occur.
if(import.meta.main) {
  const wabt=await (await import('wabt')).default();
  const args='local.get 0 local.get 1 local.get 2 local.get 3';
  const sig='(param i32 i32 i32 i32) (result f32)';
  const wat=`(module (type $t10 (func (param i32 i32 i32) (result f32))) (table $T0 501 501 funcref)
    (func $f312 ${t} local.get 0 local.get 1 i32.sub local.get 2 i32.mul f32.convert_i32_s)
    (func $other ${t} local.get 2 local.get 1 i32.sub local.get 0 i32.mul f32.convert_i32_s)
    (func $wrong) (elem (i32.const 405) func $wrong $other $f312)
    (func (export "base") ${sig} ${args} ${indirect})
    (func (export "test") ${sig} (local $jointTarget i32) ${args} ${choice}))`;
  const w=wabt.parseWat('dispatch-boundary',wat);
  try {
    w.validate(); const {base,test}=new WebAssembly.Instance(new WebAssembly.Module(w.toBinary({}).buffer)).exports;
    for(const [idx,value] of [[407,26],[406,56]]) {
      assert.equal(base(7,5,13,idx),value); assert.equal(test(7,5,13,idx),value);
    }
    for(const idx of [405,0,501]) for(const fn of [base,test]) assert.throws(()=>fn(7,5,13,idx),WebAssembly.RuntimeError);
    console.log('OK: same arguments/result for primary and alternate; wrong type, null and out-of-range still trap.');
  } finally { w.destroy(); }
}
