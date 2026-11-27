import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {Matrix4,Object3D,Vector3,Vector4} from 'three';
import {ThreeMmdLoader,FallbackCore,disposeMmdModel} from '@yohawing/three-mmd-loader';
import {mixedMaskPmx} from '../experiments/gpu-cloth/fixtures/mixed-mask.mjs';
import {fitRig} from '../experiments/gpu-cloth/rig.js';
import {makeHandSamples} from '../experiments/gpu-cloth/handSamples.js';
import {GRIP_RADIUS} from '../experiments/gpu-cloth/handMotion.js';

// CPU test of the data and frame contract, not a substitute for WGSL execution.
const hook=registerHooks({load(url,ctx,next){return url.endsWith('.wgsl?raw')?
  {format:'module',source:'export default "";',shortCircuit:true}:next(url,ctx);}});
const {createClothDriver}=await import('./webgpu-actor/clothDriver.js');hook.deregister();
function recordingDevice(){
  const buffers=[],submits=[],writes=[];
  return {buffers,submits,writes,queue:{writeBuffer(b,offset,a){assert.equal(offset,0);b.data=a.slice();writes.push({buffer:b,bytes:a.byteLength});},submit(e){submits.push(e[0]);}},
    createBuffer(desc){const b={...desc,destroy(){this.destroyed=true;}};buffers.push(b);return b;},
    createShaderModule:()=>({getCompilationInfo:()=>({messages:[]})}),
    createComputePipelineAsync:({compute})=>({...compute,getBindGroupLayout:()=>0}),
    createBindGroup:({entries})=>Object.fromEntries(entries.map(e=>[e.binding,e.resource.buffer])),
    createCommandEncoder(){const dispatches=[];let pipe,group;return {beginComputePass:()=>({setPipeline(p){pipe=p;},setBindGroup(_,b){group=b;},
      dispatchWorkgroups(){dispatches.push({name:pipe.entryPoint,group});},end(){}}),finish:()=>dispatches};},
  };
}
const near=(a,b,msg)=>assert.ok(Math.abs(a-b)<3e-5,`${msg}: ${a} differs from ${b}`);
const vecNear=(a,b,msg)=>near(a.distanceTo(b),0,msg);

async function loadFixture(t){
  const original=globalThis.GPUBufferUsage;globalThis.GPUBufferUsage={STORAGE:128,UNIFORM:64,COPY_DST:8};
  t.after(()=>{if(original)globalThis.GPUBufferUsage=original;else delete globalThis.GPUBufferUsage;});
  const model=await new ThreeMmdLoader({core:new FallbackCore()}).loadModel(mixedMaskPmx(),{morphSplit:false,outline:false});
  t.after(()=>disposeMmdModel(model));return model;
}
async function attachDriver(t,model,rig){
  const d=recordingDevice(),output=label=>d.createBuffer({label,size:rig.rest.byteLength,usage:136});
  const points=output('points'),goals=output('goals'),driver=await createClothDriver({backend:{device:d}},model,rig,{points,goals});
  t.after(driver.dispose);return {d,points,goals,driver};
}

test('placed, posed PMX: compact palette skins the same authored faces at both placement scales',async t=>{
  const model=await loadFixture(t),{mesh}=model;
  // Also exercise a non-identity bindMatrix independently of the current placement.
  const parent=new Object3D();parent.add(model.root);parent.position.set(2,1,-3);parent.rotation.y=-.29;
  parent.updateMatrixWorld(true);mesh.bind(mesh.skeleton);
  // A shared non-cloth bone also moves every face. Its repeated sample terms
  // need one palette slot and must retain their -1 cloth-node reference.
  const {skinIndex,skinWeight}=mesh.geometry.attributes;
  for(let i=0;i<skinWeight.count;i++){skinIndex.setY(i,0);skinWeight.setXY(i,.75,.25);}
  const rig=fitRig(mesh);rig.handSamples=makeHandSamples(mesh,rig);assert.ok(rig.handSamples.faces.length>0);
  const {faces,heads}=rig.handSamples,authored=rig.handSamples.terms.slice();
  const boneIds=new Set(authored.filter((_,i)=>i%8===4));
  assert.deepEqual([...boneIds].sort((a,b)=>a-b),[0,2,4,6,8]);
  const originalPosition=mesh.geometry.attributes.position;mesh.userData.mmdTslSparsePositionMorphs=true;
  assert.throws(()=>makeHandSamples(mesh,rig),/before TSL/);
  const {d,points,goals,driver}=await attachDriver(t,model,rig);
  assert.equal(d.submits.length,0);
  const {bones}=mesh.skeleton;
  const tip=rig.nodes[rig.hem];for(const b of boneIds)bones[b].rotation.set(.05*b,0,-.03*b);
  bones[0].rotation.y=.32;bones[0].position.x+=.8;
  const hands=[new Vector3(-1.2,8,.8),new Vector3(1.35,7.9,.9)];
  for(const scale of [.1,.073]){
    parent.scale.setScalar(scale);parent.rotation.set(.08,scale*9,-.17);parent.position.set(scale*20,.22,-1.9);parent.updateMatrixWorld(true);
    const world=hands.map(p=>mesh.localToWorld(p.clone())),before=d.writes.length;driver.reset();assert.equal(driver.step(0,world),1);
    const calls=d.submits.at(-1),sample=calls.find(x=>x.name==='handSamples'),lift=calls.findLast(x=>x.name==='liftNodes');
    assert.equal(lift.group[5],points);assert.equal(sample.group[4],goals);
    const toMetric=p=>mesh.worldToLocal(p).multiplyScalar(rig.scale);
    vecNear(new Vector3().fromArray(goals.data,4*rig.hem),toMetric(bones[tip.bone].getWorldPosition(new Vector3())),'posed hem');
    const caps=lift.group[7].data,c=rig.capsules[0];vecNear(new Vector3().fromArray(caps),toMetric(c.bone.localToWorld(c.a.clone())),'body');
    for(const [i,p] of hands.entries()){
      const o=(rig.capsules.length+i)*8;vecNear(new Vector3().fromArray(caps,o),p.clone().multiplyScalar(rig.scale),'palm');
      near(caps[o+3],GRIP_RADIUS*rig.scale/scale,'collision radius');near(sample.group[0].data[i*8+7],caps[o+3],'sweep radius');
    }
    const terms=sample.group[2].data,palette=sample.group[3];
    assert.deepEqual(rig.handSamples.terms,authored);
    assert.equal(palette.size,boneIds.size*64);
    assert.deepEqual(d.writes.slice(before).filter(w=>w.buffer===palette).map(w=>w.bytes),[palette.size]);
    assert.equal(terms.length,authored.length);
    for(let i=0;i<terms.length;i++)if(i%8!==4)assert.equal(terms[i],authored[i]);
    // Replay the exact bound terms/matrices for every sample, comparing against
    // Three's independent full-skeleton skinning of its original triangle.
    for(const [f,face] of faces.entries()){
      const expected=new Vector3(),sampled=new Vector3();
      for(const [j,id] of face.ids.entries())expected.addScaledVector(mesh.applyBoneTransform(id,new Vector3().fromBufferAttribute(originalPosition,id)),face.bary[j]);
      const start=heads[f*4],count=heads[f*4+1];
      for(let k=start;k<start+count;k++){
        const i=8*k,v=new Vector4().fromArray(terms,i).applyMatrix4(new Matrix4().fromArray(palette.data,terms[i+4]*16));
        sampled.add(new Vector3(v.x,v.y,v.z));
      }
      vecNear(sampled,expected,'original triangle under posed skin');
    }
  }
  const prior=d.submits.length;assert.equal(driver.step(1/144,[null,null]),0);assert.equal(d.submits.length,prior);
  assert.equal(driver.step(1/144,[null,null]),1);assert.equal(driver.step(.15,[null,null]),3);
  assert.equal(driver.step(2,[null,null]),1); // stale frame reseeds, does not replay the pause
  assert.equal(d.submits.length,prior+3);driver.reset();driver.dispose();assert.equal(d.submits.length,prior+3);
  assert.ok(d.buffers.every(b=>!!b.destroyed===(b!==points&&b!==goals)));assert.equal(driver.step(1/72,[null,null]),0);
});

test('zero-tick loss and placement changes reach the next sweep without visiting any bones',async t=>{
  const model=await loadFixture(t),{mesh}=model,parent=new Object3D();
  parent.add(model.root);parent.scale.setScalar(.1);
  const rig=fitRig(mesh);rig.handSamples=makeHandSamples(mesh,rig);
  const {d,driver}=await attachDriver(t,model,rig);
  const waist=t.mock.method(mesh.skeleton.bones[0],'updateWorldMatrix').mock;
  const placement=t.mock.method(parent,'updateWorldMatrix').mock;
  const left=new Vector3(-.12,.8,0),right=new Vector3(.13,.8,0),hands=[left,right];
  const latest=()=>d.submits.at(-1),sweep=()=>latest().find(x=>x.name==='handSamples').group[0].data;
  const flags=()=>[sweep()[3],sweep()[11]];
  function halfTick(palms){
    const bonesBefore=waist.callCount(),writes=d.writes.length,submits=d.submits.length;
    assert.equal(driver.step(1/144,palms),0);
    assert.equal(waist.callCount(),bonesBefore);assert.equal(d.writes.length,writes);assert.equal(d.submits.length,submits);
  }

  assert.equal(driver.step(0,hands),1);assert.deepEqual(flags(),[0,0]);assert.equal(waist.callCount(),1);
  // Move AND scale the parent for only the inter-tick observation. In solver
  // space .22 exceeds the scaled discontinuity threshold (.15), .025 does not.
  parent.position.x=1.2;parent.scale.setScalar(.2);
  const world=p=>p.clone().multiplyScalar(2).add(parent.position);
  halfTick([world(new Vector3(left.x+.22,.8,0)),world(new Vector3(right.x+.025,.8,0))]);
  parent.position.x=0;parent.scale.setScalar(.1);right.x+=.01;
  assert.equal(driver.step(1/144,hands),1);assert.equal(waist.callCount(),2);assert.deepEqual(flags(),[0,1]);
  near(sweep()[8],.13,'right sweep starts at last solve');near(sweep()[12],right.x,'current right palm');

  halfTick([left,null]);assert.equal(driver.step(1/144,hands),1);assert.deepEqual(flags(),[1,0]);
  const parentsBefore=placement.callCount();halfTick(null);assert.equal(placement.callCount(),parentsBefore);
  assert.equal(driver.step(1/144,hands),1);assert.deepEqual(flags(),[0,0]);
  const palette=latest().find(x=>x.name==='handSamples').group[3],writes=d.writes.length;
  assert.equal(driver.step(1/72,null),1);assert.ok(!latest().some(x=>x.name==='handSamples'));
  assert.ok(!d.writes.slice(writes).some(w=>w.buffer===palette));

  driver.reset();const bonesBefore=waist.callCount();assert.equal(driver.step(0,hands),1);
  assert.equal(waist.callCount(),bonesBefore+1);assert.equal(latest()[0].group[0].data[1],1);assert.deepEqual(flags(),[0,0]);
});
