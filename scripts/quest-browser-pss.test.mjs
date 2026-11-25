import {test} from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from './quest-browser-pss.mjs';
const pkg='test.quest',list=`PID ARGS\n 47 ${pkg}\n49 ${pkg}:renderer --something\n50 ${pkg}2\n`;
function capture({churn=false,reused=false,missing=false}={}){let passes=0;return snapshot(pkg,async ([cmd,,pid])=>{
  if(cmd==='ps')return passes++&&churn?list+`55 ${pkg}:renderer2`:list;
  const name=pid==='47'?pkg:reused?'another':pkg+':renderer';return `** MEMINFO in pid ${pid} [${name}] **\n   ${missing?'TOTAL RSS:':'TOTAL PSS:'}   ${pid}   TOTAL RSS: 1000`;
});}
test('Sum only identified process PSS; a changing or unreadable cohort has no comparable subtotal',async()=>{
  assert.deepEqual(await capture(),{processes:2,sumPssKiB:96});assert.equal((await capture({churn:true})).error,'process-list-changed');
  assert.equal((await capture({reused:true})).error,'unreadable-process');assert.equal((await capture({missing:true})).error,'unreadable-process');
});
