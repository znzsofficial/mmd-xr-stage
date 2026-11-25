import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {takeAt,takePalms,takeLength,compareTake} from './danceTake.js';
import {recorder} from './report.js';

test('both solvers see a frozen VMD but moving independent palms, then resume the same clip',()=>{
  const sites=[new Vector3(-.2,1,.2),new Vector3(.2,1,.2)],out=sites.map(p=>p.clone());
  const pos=t=>takePalms(sites,t,out).map(p=>p?.toArray()??null);
  for(const t of [4,5,6,9,11.5,13.9])assert.equal(takeAt(t).seconds,4);
  assert.deepEqual(pos(4.5),[null,null]);const low=pos(5),high=pos(6.2);assert(high.every((p,i)=>p[1]>low[i][1]+.15));
  assert.deepEqual(pos(10),[null,high[1]]);assert.deepEqual(pos(12),[null,null]);
  assert.equal(takeAt(15).seconds,5);assert.equal(takeAt(takeLength).seconds,8);
});
test('windows carry actual VMD spans; solver boundaries never mix playing and paused samples',()=>{
  const q=recorder();for(const mode of ['bullet','gpu'])for(const phase of ['dance','both','resume'])for(let n=0;n<240;n++){
    const t=n/72;q.add({kind:'xr',mode,take:1,clip:1,phase},1000/72,1,0,phase==='both'?4:phase==='dance'?t:t+4);
  }
  for(const mode of ['bullet','gpu']){const a=q.rows.filter(r=>r.mode===mode);assert.deepEqual([...new Set(a.map(r=>r.phase))],['dance','both','resume']);
    assert(a.filter(r=>r.phase==='both').every(r=>String(r.poseSeconds)==='4,4'));assert(a.filter(r=>r.phase!=='both').every(r=>r.poseSeconds[1]-r.poseSeconds[0]>.95));}
});
test('the paired result excludes a different eye size and does not reuse the same held window',()=>{
  const b={kind:'xr',mode:'bullet',clip:1,take:2,phase:'both',poseSeconds:[4,4],views:2,dimensions:'240/240',refreshHz:72,intervalP95Ms:18};
  const g={...b,mode:'gpu',intervalP95Ms:14};
  assert.deepEqual(compareTake([b,{...g,clip:2},{...g,take:1},{...g,dimensions:'128/128'},{...g,poseSeconds:[3,4]},g,g],1,2),[{phase:'both',pairs:1,bulletP95:18,gpuP95:14}]);
});
