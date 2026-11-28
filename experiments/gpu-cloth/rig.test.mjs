import assert from 'node:assert/strict';
import test from 'node:test';
import {ThreeMmdLoader,FallbackCore,disposeMmdModel} from '@yohawing/three-mmd-loader';
import {Vector3} from 'three';
import {fitRig,contactPacket,skirtPhysicsFilter} from './rig.js';
import {makeHandSamples} from './handSamples.js';
import {encodeSwatch} from './swatch.js';
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

async function coatFixture(t) {
  const bone = [{name:'hips', p:[0,9,0], parent:-1}, {name:'spine', p:[0,11,0], parent:0}, {name:'head', p:[0,15,0], parent:1}];
  const body = [{name:'Torso', b:1, p:bone[1].p, r:1.3, h:0, dyn:false}];
  const joint = [], vertices = [], groups = [[], [], []];
  for (const [name, x] of [['coat', 1], ['ribbon', 0], ['jacket', -1]]) {
    let parent = 1, previous = 0;
    for (const [row, y] of [11, 9, 7].entries()) {
      const b = bone.length, p = [x, y, -1];
      bone.push({name:`segment ${b}`, p, parent});
      const index = body.length;
      body.push({name: row ? `segment ${b}` : name, b, p, r:.12, h:0, dyn:true});
      joint.push([index, previous, p]);
      for (const [dx, dy] of [[-.25,0], [.25,0], [0,.5]]) {
        const group = name === 'ribbon' ? 2 : 1;
        groups[group].push(vertices.length);
        vertices.push({p:[x+dx, y+dy, -1], normal:[0,0,1], b});
      }
      previous = index;
      parent = b;
    }
  }
  joint.push([3, 9, [0,7,-1]]);
  const model = await new ThreeMmdLoader({core:new FallbackCore()}).loadModel(
    encodeSwatch({bone, body, joint, vertices, groups}, 'coat-panel.pmx'), {morphSplit:false, outline:false});
  t.after(() => disposeMmdModel(model));
  return model.mesh;
}

test('fits joint-linked garment strands and preserves every body and joint of the unrelated chain', async t => {
  const mesh = await coatFixture(t), rig = fitRig(mesh);
  assert.deepEqual(rig.nodes.map(n => [n.bone, n.pin]), [[3,true], [4,false], [5,false], [9,true], [10,false], [11,false]]);
  assert.ok(makeHandSamples(mesh, rig).faces.length > 0);

  const {rigidBodies: authored, joints} = mesh.userData.mmdPhysics;
  const rigidBodies = authored.map((b, index) => ({boneIndex:b.boneIndex, motionType:b.mode, index}));
  const impulses = [3, 6].map(rigidBodyIndex => ({rigidBodyIndex}));
  const filter = skirtPhysicsFilter(rig);
  const selected = filter({rigidBodies, joints, morphImpulses:impulses});
  assert.deepEqual(selected.rigidBodies.map(b => [b.index, b.boneIndex]), [[0,1], [1,6], [2,7], [3,8]]);
  assert.deepEqual(selected.joints.map(j => [j.index, j.rigidBodyIndexA, j.rigidBodyIndexB]), [[0,1,0], [1,2,1], [2,3,2]]);
  assert.deepEqual(selected.morphImpulses, [{rigidBodyIndex:3}]);
  const incomplete = {rigidBodies:rigidBodies.slice(0,-1), joints};
  assert.equal(filter(incomplete), incomplete);
});

test('coat labels cannot override missing seams, non-garment bind weights, or attachment to another dynamic chain', async t => {
  const mesh = await coatFixture(t), physics = mesh.userData.mmdPhysics;
  const seam = physics.joints.pop();
  const unsupported = () => assert.throws(() => fitRig(mesh), /需要 4–4096/);
  unsupported();
  physics.joints.push(seam);
  const material = mesh.material[1];
  material.name = 'skin';
  unsupported();
  material.name = 'cloth';
  physics.joints.push({...seam, rigidBodyIndexB:6});
  unsupported();
});

test('a named coat draw can identify neutral body names, but it still needs two wide, descending strands', async t => {
  const mesh = await coatFixture(t), {rigidBodies} = mesh.userData.mmdPhysics;
  rigidBodies[1].name = rigidBodies[7].name = 'panel';
  mesh.material[1].name = 'Winter coat';
  assert.equal(fitRig(mesh).nodes.length, 6);

  // Raise both free tips to the top of their strands in bind space.
  for (const i of [5, 11]) mesh.skeleton.boneInverses[i].elements[13] = -11;
  assert.throws(() => fitRig(mesh), /需要 4–4096/);
});
