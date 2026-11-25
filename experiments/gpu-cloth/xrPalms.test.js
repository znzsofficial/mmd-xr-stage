import test from 'node:test';
import assert from 'node:assert/strict';
import {Matrix4} from 'three';
import {xrPalms} from './xrPalms.js';

test('a second input cannot steal a valid palm; replacement parks only its own side, and rays never stand in for hands',()=>{
  const sample=xrPalms(),lab=new Matrix4().makeTranslation(0,0,.85),left={handedness:'left',gripSpace:1},right={handedness:'right',gripSpace:2},optical={handedness:'left',hand:new Map([['wrist',-.04],['index-finger-phalanx-proximal',.03],['pinky-finger-phalanx-proximal',.05]]),targetRaySpace:'ray'};
  const session={visibilityState:'visible',inputSources:[left,right]},pose=x=>({transform:{position:{x,y:1,z:-.85}}}),frame={session,getPose:pose,getJointPose:pose};const xs=()=>sample.read(frame,{},lab).map(v=>v?.x??null);
  assert.deepEqual(xs(),[1,2]);session.inputSources=[optical,right,left];assert.deepEqual(xs(),[1,2]);session.inputSources=[optical,right];assert.deepEqual(xs(),[null,2]);
  assert.ok(Math.abs(xs()[0])<1e-9);assert.deepEqual(sample.kinds,['hand','grip']);optical.hand.delete('wrist');assert.deepEqual(xs(),[null,2]);
  session.visibilityState='visible-blurred';assert.deepEqual(xs(),[null,null]);assert.deepEqual(sample.kinds,['missing','missing']);
});
