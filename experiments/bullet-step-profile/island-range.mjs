// Offline equivalent of lower_bound/upper_bound in processIsland. The original
// solveConstraints has already sorted the pointers with btGetConstraintIslandId.
// Keep identical ordering within each range, including its null empty case.
import assert from 'node:assert/strict';

function bound(label, comparison) {
  return `local.get $l6 local.set $hi
    block $done${label}
      loop $search${label}
        local.get $lo local.get $hi i32.ge_u br_if $done${label}
        local.get $lo local.get $hi local.get $lo i32.sub i32.const 1 i32.shr_u i32.add local.set $mid
        local.get $l8 local.get $mid i32.const 2 i32.shl i32.add i32.load local.tee $joint
        i32.load offset=28 i32.load offset=208 local.tee $tag i32.const 0 i32.lt_s
        if (result i32) local.get $joint i32.load offset=32 i32.load offset=208 else local.get $tag end
        local.get $p5 ${comparison}
        if local.get $mid i32.const 1 i32.add local.set $lo else local.get $mid local.set $hi end
        br $search${label}
      end
    end`;
}

export function patchIslandRange(wat) {
  const start = wat.indexOf('\n  (func $f267 (type $t15)');
  const end = wat.indexOf('\n  (func ', start + 1);
  assert(start >= 0 && end > start);
  const original = wat.slice(start, end);
  const from = original.indexOf('        loop $L4\n');
  const to = original.indexOf('    local.get $p0\n    i32.load offset=4\n    local.tee $p5');
  assert(from >= 0 && to > from);
  const scans = original.slice(from,to);
  assert.deepEqual([...scans.matchAll(/^ +loop (\$L\d+)/gm)].map(m=>m[1]), ['$L4','$L7']);
  assert.equal((scans.match(/i32.load offset=208/g) ?? []).length, 8);
  assert(!scans.includes('call') && !scans.includes('store'));
  // Enter here only for a nonnegative island and a nonempty table. $B1 is
  // also the original zero-constraints branch; locals default to zero there.
  const searches = `        ${bound('Lower','i32.lt_s')}
        local.get $lo local.set $first
        ${bound('Upper','i32.le_s')}
        local.get $lo local.get $first i32.sub local.tee $l13
        if local.get $l8 local.get $first i32.const 2 i32.shl i32.add local.set $l17 end
      end
    end\n`;
  const locals = '(local $lo i32) (local $hi i32) (local $mid i32) (local $first i32) (local $joint i32) (local $tag i32)';
  const body = (original.slice(0,from) + searches + original.slice(to)).replace('    block $B0', `    ${locals}\n    block $B0`);
  return wat.slice(0,start) + body + wat.slice(end);
}
