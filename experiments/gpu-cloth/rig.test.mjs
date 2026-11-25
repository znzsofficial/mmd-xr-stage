import assert from 'node:assert/strict';
import test from 'node:test';
import {ThreeMmdLoader,FallbackCore,disposeMmdModel} from '@yohawing/three-mmd-loader';
import {Vector3} from 'three';
import {fitRig,contactPacket} from './rig.js';
import {mixedMaskPmx} from './fixtures/mixed-mask.mjs';

async function fixture(t){
  const model=await new ThreeMmdLoader({core:new FallbackCore()}).loadModel(mixedMaskPmx(),{morphSplit:false,outline:false});
  t.after(()=>disposeMmdModel(model));return model.mesh;
}

test('separate authored permissions for coincident hems; both hands occupy the final two slots',async t=>{
  const rig=fitRig(await fixture(t)), slots=i=>Array.from({length:64},(_,k)=>k)
    .filter(k=>(rig.headers[4*i+2+(k>>>5)]>>>(k%32))&1);
  assert.equal(rig.capsules.length,62);
  assert.deepEqual(rig.nodes.flatMap((n,i)=>n.pin?[]:[slots(i)]),[
    [...Array.from({length:30},(_,i)=>2*i),60,62,63],
    [...Array.from({length:30},(_,i)=>2*i+1),61,62,63],
    [62,63],[62,63],
  ]);
  const packet=new Float32Array(64*8);
  assert.equal(contactPacket(rig,[new Vector3(1,2,3),new Vector3(4,5,6)],packet),64);
  assert.ok(Math.abs(packet[60*8]+.022)<1e-6); // sphere before capsule; compact away the interleaved decoy
  assert.ok(Math.abs(packet[61*8+2]-.022)<1e-6&&packet[61*8+5]>packet[61*8+1]);
  assert.deepEqual([...packet.slice(62*8,62*8+3)],[1,2,3]);assert.deepEqual([...packet.slice(63*8,63*8+3)],[4,5,6]);
});

test('the 62-body budget applies to the eligible union, never silently drops an eligible collider',async t=>{
  const mesh=await fixture(t),bodies=mesh.userData.mmdPhysics.rigidBodies,b=bodies[0];
  // Bad group 34 must not alias group 2. A box, disabled mask, unbound body,
  // and pin-only permission are not projectable by either compute pass.
  bodies.push({...b,group:34},{...b,shape:'box'},{...b,mask:0},{...b,boneIndex:-1});
  const pin=bodies.find(x=>x.name==='pin 0');pin.mask=1<<8;bodies.push({...b,group:8,mask:1});
  assert.equal(fitRig(mesh).capsules.length,62);
  bodies.push({...b});assert.throws(()=>fitRig(mesh),/身体碰撞体超出/);
});
