// Census only. Tag the rows when the 6DOF limit/motor writer emits them;
// look up the tags through Bullet's live (possibly permuted) order table.
// All writes go to a second, diagnostic-only memory, never the Bullet heap.
import assert from 'node:assert/strict';

const tagCapacity=65536, passCapacity=4096;
export const kinds=['linear','angular'].flatMap(axis=>['motorOnly','locked','limit1','limit2'].map(kind=>axis+'.'+kind));
// Iteration, visited, explicitOverride visits, pool length, then generic calls
// and skipped rows by kind. Record *every* solveSingleIteration, even empty.
const stride=4+2*kinds.length;
const pages=Math.ceil((tagCapacity+4*stride*passCapacity)/65536);
const bump=`(func $jbump (param $addr i32)
    local.get $addr local.get $addr i32.load $jointTrace i32.const 1 i32.add i32.store $jointTrace)`;
export const countDecl=`(memory $jointTrace (export "jointTrace") ${pages} ${pages})
  (global $jpasses (export "jointPassCount") (mut i32) (i32.const 0))
  (global $jbase (mut i32) (i32.const 0))
  (global $jnext (mut i32) (i32.const 0))
  (global $jexplicit (mut i32) (i32.const 0))
  ${bump}`;

export function instrumentJointCounts({editFunction,entry,once}) {
  editFunction(entry('convertJoints'),fn=>{
    const resize='local.get $p0\n    local.get $l10\n    i32.store offset=48';
    fn=once(fn,resize,`${resize}
    local.get $l10 i32.const ${tagCapacity} i32.gt_u if unreachable end
    i32.const 0 global.set $jnext`);
    const getInfo2='local.get $l5\n          local.get $l7\n          i32.const 12\n          i32.add\n          local.get $l5\n          i32.load\n          i32.load offset=20\n          call_indirect $T0 (type $t3)';
    fn=once(fn,getInfo2,`local.get $l8 global.set $jbase
          local.get $l5 i32.load offset=24 i32.const 0 i32.gt_s global.set $jexplicit
          ${getInfo2}`);
    const finish='i32.const 17296\n    i32.load\n    call_indirect $T0 (type $t8)';
    return once(fn,finish,`global.get $jnext local.get $p0 i32.load offset=48 i32.ne if unreachable end\n    ${finish}`);
  });
  // get_limit_motor_info2: after (powered || limit), before the axis writes.
  // p9 is the row offset in this joint, p11 selects angular J1/J2, p1 is
  // btRotationalLimitMotor (also the temporary adapter for a linear limit).
  const writer='local.get $p1\n      i32.load8_u offset=44\n      local.tee $l36\n      local.get $p1\n      i32.load offset=56\n      local.tee $l37\n      i32.or\n      i32.eqz\n      br_if $B0';
  editFunction(writer,fn=>{
    assert(fn.includes('(func $f33 (type $t46)') && fn.includes('local.get $p1\n          f32.load offset=4\n          f32.ne\n          br_if $B4'));
    return once(fn,writer,`${writer}
      global.get $jbase local.get $p9 i32.add global.get $jnext i32.ne if unreachable end
      global.get $jnext i32.const ${tagCapacity} i32.ge_u if unreachable end
      global.get $jnext
      local.get $l37 if (result i32)
        local.get $p1 f32.load local.get $p1 f32.load offset=4 f32.eq
        if (result i32) i32.const 1 else
          local.get $l37 i32.const 2 i32.gt_u if unreachable end
          local.get $l37 i32.const 1 i32.add
        end
      else i32.const 0 end
      local.get $p11 i32.const 2 i32.shl i32.or
      global.get $jexplicit i32.const 3 i32.shl i32.or i32.store8 $jointTrace
      global.get $jnext i32.const 1 i32.add global.set $jnext`);
  });
  editFunction(entry('solveSingleIteration'),fn=>{
    const open=entry('solveSingleIteration'), guard='local.tee $p2\n        i32.load offset=136\n        local.get $p1\n        i32.gt_s\n        if $I14';
    fn=once(fn,open,`${open}
    global.get $jpasses i32.const ${passCapacity} i32.ge_u if unreachable end
    global.get $jpasses i32.const ${4*stride} i32.mul i32.const ${tagCapacity} i32.add local.tee $jrecord
    i32.const 0 i32.const ${4*stride} memory.fill $jointTrace
    local.get $jrecord local.get $p1 i32.store $jointTrace
    local.get $jrecord local.get $p0 i32.load offset=48 i32.store $jointTrace offset=12
    global.get $jpasses i32.const 1 i32.add global.set $jpasses`);
    fn=once(fn,'    (local $l10','    (local $jrecord i32) (local $jtag i32)\n    (local $l10');
    const addr='i32.load\n        i32.const 152\n        i32.mul\n        i32.add\n        '+guard;
    fn=once(fn,addr,`i32.load
        local.tee $jtag
        local.get $jtag i32.load8_u $jointTrace local.set $jtag
        local.get $jrecord i32.const 4 i32.add call $jbump
        local.get $jtag i32.const 8 i32.and if local.get $jrecord i32.const 8 i32.add call $jbump end
        i32.const 152\n        i32.mul\n        i32.add\n        ${guard}`);
    const count=offset=>`local.get $jrecord i32.const ${offset} i32.add local.get $jtag i32.const 7 i32.and i32.const 2 i32.shl i32.add call $jbump`;
    const dispatch='i32.load offset=212\n          call_indirect $T0 (type $t10)\n          local.tee $l14';
    const start=fn.indexOf(guard), end=fn.indexOf('br_if $L13');
    let branch=fn.slice(start,end);
    branch=once(branch,dispatch,dispatch.replace('local.tee',`${count(16)}\n          local.tee`));
    const tail='local.set $p4\n        end\n        local.get $p3\n        i32.const 1';
    return fn.slice(0,start)+once(branch,tail,tail.replace('end',`else\n          ${count(16+4*kinds.length)}\n        end`))+fn.slice(end);
  });
}

export function drainJointPasses(exports) {
  const n=exports.jointPassCount.value;
  const data=new Uint32Array(exports.jointTrace.buffer,tagCapacity,n*stride), passes=[];
  for(let i=0;i<n;i++) {
    const p=Array.from(data.subarray(i*stride,(i+1)*stride)), [iteration,visited,explicit,pool]=p;
    assert.equal(visited,pool); assert(explicit<=visited);
    assert.equal(p.slice(4).reduce((a,b)=>a+b,0),visited);
    passes.push([iteration,visited,explicit,...p.slice(4)]);
  }
  exports.jointPassCount.value=0;
  return passes;
}

// Exact ordered records, compressed by dictionary per window. No per-row
// host calls. Preserve separate island batches with equal iteration numbers.
export function passReport(passes,detail=false) {
  const sum=Array(2*kinds.length).fill(0), ids=new Map(), passIds=[];
  let visits=0, explicitVisits=0, nonempty=0;
  for(const p of passes){
    visits+=p[1]; explicitVisits+=p[2]; if(p[1]) nonempty++;
    sum.forEach((_,i)=>sum[i]+=p[i+3]);
    if(detail){const key=p.join(','); if(!ids.has(key))ids.set(key,ids.size); passIds.push(ids.get(key));}
  }
  const byKind=start=>Object.fromEntries(kinds.map((k,i)=>[k,sum[start+i]]));
  const executed=sum.slice(0,kinds.length).reduce((a,b)=>a+b,0);
  return {passes:passes.length,nonempty,visits,explicitVisits,executed,skipped:visits-executed,
    executedByKind:byKind(0),skippedByKind:byKind(kinds.length),
    ...(detail && {patterns:Array.from(ids.keys(),s=>s.split(',').map(Number)),passIds})};
}
