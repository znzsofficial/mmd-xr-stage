// Independent of the census: exact whole-pass time and sparse virtual-call
// timing. Repeating getInfo1/getInfo2 would change the work being measured.
import assert from 'node:assert/strict';

const names=['info1','info2'], stats={calls:'i32',samples:'i32',passNs:'f64',rawNs:'f64',blankNs:'f64'};
export const costImport='(import "stage" "nowNs" (func $jointNow (result f64)))';
export const costDecl=names.flatMap(k=>Object.entries(stats).map(([s,t])=>
  `(global $${k}${s} (export "${k}${s}") (mut ${t}) (${t}.const 0))`)).join('\n  ');

export function instrumentJointCosts({editFunction,entry,once}) {
  editFunction(entry('convertJoints'),fn=>{
    fn=once(fn,'    (local $l4','    (local $batchStart f64) (local $sampleStart f64) (local $sample i32)\n    (local $l4');
    for(const [k,guard,loop,slot,indent] of [['info1',12,13,16,12],['info2',25,26,20,10]]) {
      const head=`    if $I${guard}\n`,tail=`        br_if $L${loop}\n      end\n    end`;
      fn=once(fn,head,head+'      call $jointNow local.set $batchStart\n');
      fn=once(fn,tail,`        br_if $L${loop}\n      end\n      global.get $${k}passNs call $jointNow local.get $batchStart f64.sub f64.add global.set $${k}passNs\n    end`);
      const spacing=' '.repeat(indent), call=`i32.load offset=${slot}\n${spacing}call_indirect $T0 (type $t3)`;
      // Same indirect call and arguments on the operand stack. Include virtual
      // dispatch in the sample, exclude argument evaluation and the selector.
      // Multiply by an odd Weyl increment before taking five high bits; don't
      // always sample the first joint of a batch or a single joint index.
      fn=once(fn,call,`i32.load offset=${slot}
        global.get $${k}calls i32.const 1 i32.add global.set $${k}calls
        global.get $${k}calls i32.const -1640531527 i32.mul i32.const 27 i32.shr_u i32.eqz local.tee $sample
        if call $jointNow local.set $sampleStart end
        call_indirect $T0 (type $t3)
        local.get $sample if
          call $jointNow local.get $sampleStart f64.sub global.get $${k}rawNs f64.add global.set $${k}rawNs
          call $jointNow local.set $sampleStart call $jointNow local.get $sampleStart f64.sub global.get $${k}blankNs f64.add global.set $${k}blankNs
          global.get $${k}samples i32.const 1 i32.add global.set $${k}samples
        end`);
    }
    return fn;
  });
}

export function costSnapshot(exports) {
  return Object.fromEntries(names.map(k=>[k,Object.fromEntries(Object.keys(stats).map(s=>[s,exports[k+s].value]))]));
}
export function costReport(before,after,n,parentNs) {
  let otherNs=parentNs;
  const detail={};
  for(const k of names){
    const {calls,samples,passNs,rawNs,blankNs}=Object.fromEntries(Object.keys(stats).map(s=>[s,after[k][s]-before[k][s]]));
    assert(samples<=calls && rawNs<=passNs && passNs>=0 && blankNs>=0 && rawNs>=0);
    otherNs-=passNs;
    detail[k]={calls,samples,passNs,passMsPerStep:passNs/(n*1e6),sampleRawNs:rawNs,sampleBlankNs:blankNs,
      rawNsPerSample:samples?rawNs/samples:null,blankNsPerSample:samples?blankNs/samples:null};
  }
  assert(otherNs>=0,'Joint conversion passes escape convertJoints');
  return {convertJointsNs:parentNs,otherNs,...detail};
}
