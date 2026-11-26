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
  const buffers=[],submits=[];
  return {buffers,submits,queue:{writeBuffer(b,_,a){b.data=a.slice();},submit(e){submits.push(e[0]);}},
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

test('placed, posed PMX: goal, collision proxy, two palms and sampled garment all meet in mesh metric',async t=>{
  const original=globalThis.GPUBufferUsage;globalThis.GPUBufferUsage={STORAGE:128,UNIFORM:64,COPY_DST:8};
  t.after(()=>{if(original)globalThis.GPUBufferUsage=original;else delete globalThis.GPUBufferUsage;});
  const model=await new ThreeMmdLoader({core:new FallbackCore()}).loadModel(mixedMaskPmx(),{morphSplit:false,outline:false});
  t.after(()=>disposeMmdModel(model));const {mesh}=model;
  // Also exercise a non-identity bindMatrix independently of the current placement.
  const parent=new Object3D();parent.add(model.root);parent.position.set(2,1,-3);parent.rotation.y=-.29;
  parent.updateMatrixWorld(true);mesh.bind(mesh.skeleton);
  const rig=fitRig(mesh);rig.handSamples=makeHandSamples(mesh,rig);assert.ok(rig.handSamples.faces.length>0);
  const originalPosition=mesh.geometry.attributes.position;mesh.userData.mmdTslSparsePositionMorphs=true;
  assert.throws(()=>makeHandSamples(mesh,rig),/before TSL/);
  const d=recordingDevice(),output=label=>d.createBuffer({label,size:rig.rest.byteLength,usage:136});
  const points=output('points'),goals=output('goals'),driver=await createClothDriver({backend:{device:d}},model,rig,{points,goals});
  t.after(driver.dispose);
  assert.equal(d.submits.length,0);
  const {bones}=mesh.skeleton;
  const tip=rig.nodes[rig.hem];bones[tip.bone].rotation.set(.21,0,-.18);bones[0].rotation.y=.32;bones[0].position.x+=.8;
  const hands=[new Vector3(-1.2,8,.8),new Vector3(1.35,7.9,.9)];
  for(const scale of [.1,.073]){
    parent.scale.setScalar(scale);parent.rotation.set(.08,scale*9,-.17);parent.position.set(scale*20,.22,-1.9);parent.updateMatrixWorld(true);
    const world=hands.map(p=>mesh.localToWorld(p.clone()));driver.reset();assert.equal(driver.step(0,world),1);
    const calls=d.submits.at(-1),sample=calls.find(x=>x.name==='handSamples'),lift=calls.findLast(x=>x.name==='liftNodes');
    assert.equal(lift.group[5],points);assert.equal(sample.group[4],goals);
    const toMetric=p=>mesh.worldToLocal(p).multiplyScalar(rig.scale);
    vecNear(new Vector3().fromArray(goals.data,4*rig.hem),toMetric(bones[tip.bone].getWorldPosition(new Vector3())),'posed hem');
    const caps=lift.group[7].data,c=rig.capsules[0];vecNear(new Vector3().fromArray(caps),toMetric(c.bone.localToWorld(c.a.clone())),'body');
    for(const [i,p] of hands.entries()){
      const o=(rig.capsules.length+i)*8;vecNear(new Vector3().fromArray(caps,o),p.clone().multiplyScalar(rig.scale),'palm');
      near(caps[o+3],GRIP_RADIUS*rig.scale/scale,'collision radius');near(sample.group[0].data[i*8+7],caps[o+3],'sweep radius');
    }
    // Independently skin the original three corners with Three and interpolate.
    const {faces,terms,heads}=rig.handSamples,face=faces[0],expected=new Vector3(),sampled=new Vector3();
    for(const [j,id] of face.ids.entries())expected.addScaledVector(mesh.applyBoneTransform(id,new Vector3().fromBufferAttribute(originalPosition,id)),face.bary[j]);
    for(let k=heads[0];k<heads[0]+heads[1];k++){
      const i=8*k,v=new Vector4().fromArray(terms,i).applyMatrix4(new Matrix4().fromArray(sample.group[3].data,terms[i+4]*16));
      sampled.add(new Vector3(v.x,v.y,v.z));
    }
    vecNear(sampled,expected,'original triangle under posed skin');
  }
  const prior=d.submits.length;assert.equal(driver.step(1/144,[null,null]),0);assert.equal(d.submits.length,prior);
  assert.equal(driver.step(1/144,[null,null]),1);assert.equal(driver.step(.15,[null,null]),3);
  assert.equal(driver.step(2,[null,null]),1); // stale frame reseeds, does not replay the pause
  assert.equal(d.submits.length,prior+3);driver.reset();driver.dispose();assert.equal(d.submits.length,prior+3);
  assert.ok(d.buffers.every(b=>!!b.destroyed===(b!==points&&b!==goals)));assert.equal(driver.step(1/72,[null,null]),0);
});
