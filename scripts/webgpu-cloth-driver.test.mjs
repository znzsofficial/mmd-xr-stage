import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
import {setImmediate as nextTurn} from 'node:timers/promises';
import {Matrix4,Object3D,Vector3,Vector4} from 'three';
import {ThreeMmdLoader,FallbackCore,disposeMmdModel} from '@yohawing/three-mmd-loader';
import {mixedMaskPmx} from '../experiments/gpu-cloth/fixtures/mixed-mask.mjs';
import {fitRig} from '../experiments/gpu-cloth/rig.js';
import {makeHandSamples} from '../experiments/gpu-cloth/handSamples.js';
import {GRIP_RADIUS} from '../experiments/gpu-cloth/handMotion.js';
import {clothProgram} from '../experiments/gpu-cloth/clothPrograms.js';

// CPU test of the data and frame contract, not a substitute for WGSL execution.
const hook=registerHooks({load(url,ctx,next){return url.endsWith('.wgsl?raw')?
  {format:'module',source:`export default ${JSON.stringify(readFileSync(new URL(url),'utf8'))};`,shortCircuit:true}:next(url,ctx);}});
const {createClothDriver}=await import('./webgpu-actor/clothDriver.js');
const {gpuResources,makeClothKernel,prepareClothPipelines}=await import('../experiments/gpu-cloth/clothKernel.js');hook.deregister();
function recordingDevice(){
  const buffers=[],submits=[],writes=[];
  return {buffers,submits,writes,queue:{writeBuffer(b,offset,a){assert.equal(offset,0);b.data=a.slice();writes.push({buffer:b,bytes:a.byteLength});},submit(e){submits.push(e[0]);}},
    createBuffer(desc){const b={...desc,destroy(){this.destroyed=true;}};buffers.push(b);return b;},
    createShaderModule:()=>({getCompilationInfo:()=>({messages:[]})}),
    createComputePipelineAsync:({compute})=>({...compute,getBindGroupLayout:()=>0}),
    createBindGroup:({entries})=>Object.fromEntries(entries.map(e=>{assert.ok(!e.resource.buffer.destroyed);return [e.binding,e.resource.buffer];})),
    createCommandEncoder(){const dispatches=[];let pipe,group;return {beginComputePass:()=>({setPipeline(p){pipe=p;},setBindGroup(_,b){group=b;},
       dispatchWorkgroups(){dispatches.push({name:pipe.entryPoint,pipe,group});},end(){}}),finish:()=>dispatches};},
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

test('cold sampled rig starts both modules and all four entries before allocating actor resources',async t=>{
  const model=await loadFixture(t), rig=fitRig(model.mesh), device=recordingDevice();
  rig.handSamples=makeHandSamples(model.mesh,rig);
  const output=label=>device.createBuffer({label,size:rig.rest.byteLength,usage:136});
  const surface={points:output('points'),goals:output('goals')};
  const start=()=>createClothDriver({backend:{device}},model,rig,surface);
  const modules=Promise.withResolvers(), entries=new Map();
  const shaders=t.mock.method(device,'createShaderModule',()=>({getCompilationInfo:()=>modules.promise})).mock;
  const create=device.createComputePipelineAsync;
  const pipelines=t.mock.method(device,'createComputePipelineAsync',descriptor=>{
    const gate=Promise.withResolvers();entries.set(descriptor.compute.entryPoint,gate);
    return gate.promise.then(()=>create(descriptor));
  }).mock;
  const binds=t.mock.method(device,'createBindGroup').mock;
  const ready=start();await nextTurn();
  assert.equal(shaders.callCount(),2);assert.equal(entries.size,0);
  modules.resolve({messages:[]});await nextTurn();
  assert.deepEqual([...entries.keys()].sort(),['constrain','handSamples','liftNodes','predict']);

  const failed=assert.rejects(ready,/compile failed/);
  entries.get('constrain').reject(Error('compile failed'));await failed;
  const retry=start();await nextTurn();
  assert.equal(shaders.callCount(),2);assert.equal(pipelines.callCount(),5);
  for(const [name,gate] of entries)if(name!=='liftNodes')gate.resolve();
  await nextTurn();
  assert.deepEqual(device.buffers,Object.values(surface));assert.equal(binds.callCount(),0);
  entries.get('liftNodes').resolve();const driver=await retry;t.after(driver.dispose);
  assert.ok(binds.callCount()>0);
});

test('cold no-hand rig, concurrent hand attach and warm reattach share four pipelines but no actor bindings',async t=>{
  const model=await loadFixture(t), rig=fitRig(model.mesh), device=recordingDevice();
  rig.handSamples=makeHandSamples(model.mesh,rig);
  const shaders=t.mock.method(device,'createShaderModule').mock;
  const pipelines=t.mock.method(device,'createComputePipelineAsync').mock;
  const entryPoints=()=>pipelines.calls.map(call=>call.arguments[0].compute.entryPoint).sort();
  function start(handSamples,signal){
    const output=label=>device.createBuffer({label,size:rig.rest.byteLength,usage:136});
    const surface={points:output('points'),goals:output('goals')};
    const ready=createClothDriver({backend:{device}},model,{...rig,handSamples},surface,signal);
    return {...surface,ready};
  }
  const empty={faces:[],terms:new Float32Array()};
  const first=await start(empty).ready;
  assert.equal(shaders.callCount(),1);
  assert.deepEqual(entryPoints(),['constrain','predict']);
  assert.ok(!device.buffers.some(b=>b.label==='hand surface skin palette'));
  first.dispose();

  const compiling=Promise.withResolvers(), release=Promise.withResolvers();
  shaders.mockImplementationOnce(()=>({getCompilationInfo(){compiling.resolve();return release.promise;}}));
  const abort=new AbortController(), retiring=start(rig.handSamples,abort.signal), survivor=start(rig.handSamples);
  await compiling.promise;
  abort.abort();retiring.points.destroy();retiring.goals.destroy();
  const aborted=assert.rejects(retiring.ready,{name:'AbortError'});
  release.resolve({messages:[]});
  const driver=await survivor.ready;t.after(driver.dispose);await aborted;
  const warm=start(rig.handSamples), other=await warm.ready;t.after(other.dispose);
  assert.equal(shaders.callCount(),2);
  assert.deepEqual(entryPoints(),['constrain','handSamples','liftNodes','predict']);

  const hands=[new Vector3(-.12,.8,0),new Vector3(.12,.8,0)];
  function step(current,surface){
    assert.equal(current.step(1/72,hands),1);
    const calls=device.submits.at(-1), sample=calls.find(c=>c.name==='handSamples');
    assert.equal(sample.group[4],surface.goals);assert.equal(sample.group[5],surface.points);
    const buffers=new Set(calls.flatMap(c=>Object.values(c.group)));
    for(const buffer of buffers)assert.ok(!buffer.destroyed);
    return buffers;
  }
  const bound=step(driver,survivor), warmBound=step(other,warm);
  for(const buffer of warmBound)assert.ok(!bound.has(buffer));
  driver.dispose();
  for(const buffer of bound)assert.equal(!!buffer.destroyed,buffer!==survivor.goals&&buffer!==survivor.points);
  step(other,warm);

  // The standalone lab uses this exact solver module for its unculled probe.
  const resources=gpuResources(device);t.after(resources.dispose);
  const compiled=await prepareClothPipelines(device,empty);
  const kernel=makeClothKernel(device,rig,resources,{...warm,handSamples:empty},compiled);
  const constrain=pipelines.calls.find(call=>call.arguments[0].compute.entryPoint==='constrain');
  assert.equal(kernel.solver,constrain.arguments[0].compute.module);
  assert.equal(shaders.callCount(),2);
  const pipe=await device.createComputePipelineAsync({layout:'auto',compute:{module:kernel.solver,entryPoint:'constrain',constants:{cull:false}}});
  const groups=kernel.relaxGroups(pipe), encoder=device.createCommandEncoder();
  kernel.run(encoder.beginComputePass(),1,false,{pipe,groups});
  const relaxation=encoder.finish().slice(1);
  assert.ok(relaxation.every(call=>call.pipe===pipe));
  assert.deepEqual(relaxation.map(c=>c.group),[groups[1],groups[0],groups[1],groups[0],groups[1]]);
});

test('failed shader or entry can retry while a successful or in-flight sibling remains shared',async t=>{
  const device=recordingDevice();
  const shaders=t.mock.method(device,'createShaderModule').mock;
  shaders.mockImplementationOnce(()=>({getCompilationInfo:()=>({messages:[{type:'error',lineNum:8,message:'invalid source'}]})}));
  const bad=clothProgram(device,'source','first');
  assert.equal(clothProgram(device,'source','second'),bad);
  await assert.rejects(bad,/first: 8: invalid source/);
  const program=await clothProgram(device,'source','retry');
  const held=Promise.withResolvers(), pipelines=t.mock.method(device,'createComputePipelineAsync').mock;
  pipelines.mockImplementationOnce(()=>held.promise);
  const predict=program.pipeline('predict');
  pipelines.mockImplementationOnce(()=>Promise.reject(Error('compile failed')));
  const constrain=program.pipeline('constrain');
  assert.equal(program.pipeline('constrain'),constrain);
  await assert.rejects(constrain,/compile failed/);
  const retried=await program.pipeline('constrain');
  assert.equal(program.pipeline('predict'),predict);
  held.resolve({});await predict;
  assert.equal(await program.pipeline('constrain'),retried);
  const variant=await clothProgram(device,'different source','retry');
  assert.notEqual(await variant.pipeline('constrain'),retried);
  assert.equal(shaders.callCount(),3);assert.equal(pipelines.callCount(),4);
});

test('device loss retires warm and pending entries without invalidating the replacement device',async t=>{
  const old=recordingDevice(), replacement=recordingDevice(), loss=Promise.withResolvers();
  old.lost=loss.promise;
  const program=await clothProgram(old,'source','solver');
  const warm=await program.pipeline('predict');
  const held=Promise.withResolvers();
  t.mock.method(old,'createComputePipelineAsync',()=>held.promise);
  const pending=program.pipeline('constrain');
  const next=await clothProgram(replacement,'source','solver');
  const nextPredict=await next.pipeline('predict');assert.notEqual(nextPredict,warm);
  loss.resolve({message:'lost during compile'});held.resolve({});
  await assert.rejects(pending,/lost during compile/);
  await assert.rejects(program.pipeline('predict'),/lost during compile/);
  await assert.rejects(clothProgram(old,'source','solver'),/lost during compile/);
  assert.equal(await (await clothProgram(replacement,'source','solver')).pipeline('predict'),nextPredict);
});

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
