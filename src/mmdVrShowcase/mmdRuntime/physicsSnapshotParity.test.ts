import { expect, it } from 'vitest';
import { Bone, Skeleton, SkinnedMesh } from 'three';
import { DefaultMmdRuntime } from '@yohawing/three-mmd-loader/runtime';
import type { MmdAnimation } from '@yohawing/three-mmd-loader';
import type { MmdPhysicsBackend } from '@yohawing/three-mmd-loader/physics';

it('keeps physics inputs and displayed bones identical with debug capture disabled; the default still exposes every stage',()=>{
  const run=(captureStageSnapshots?:boolean,coalescePhysicsWorldUpdates=false)=>{
    const mesh=new SkinnedMesh(),parent=new Bone(),child=new Bone();parent.name='hip';child.name='hem';
    parent.position.set(.1,.52,-.2);parent.rotation.set(.3,.2,.1);child.position.set(.2,-.46,.12);
    mesh.add(parent);parent.add(child);mesh.bind(new Skeleton([parent,child]));
    const inputs:number[][]=[],poses:number[][]=[],segments:number[][]=[];
    const backend:MmdPhysicsBackend={name:'matrix-echo',disabled:false,disposed:false,step(c){
      inputs.push(Array.from(c.inputWorldMatricesColumnMajor!));const o=c.output!;
      o.translations![4]=Math.fround(-.46+c.seconds/8);o.updatedBoneIndices![0]=1;
      return {simulated:true,updatedBoneCount:1};
    }};
    const runtime=new DefaultMmdRuntime({physics:'external',physicsBackend:backend,captureStageSnapshots,coalescePhysicsWorldUpdates,onPhysicsPoseWork:(...ms)=>segments.push(ms)});
    const clip:MmdAnimation={kind:'vmd',metadata:{modelName:'',maxFrame:1,counts:{bones:0,morphs:0,cameras:0,lights:0,selfShadows:0,properties:0}},bytes:new Uint8Array(),boneTracks:{},morphTracks:{},cameraFrames:[],lightFrames:[],propertyFrames:[],selfShadowFrames:[]};
    runtime.setAnimation(clip,mesh);
    for(const t of [0,1/60,2/60,.01]){runtime.tick(t,{mesh,physics:true});poses.push([...child.matrixWorld.elements]);}
    const stages=runtime.debugState().stages;expect(segments).toHaveLength(4);
    expect(segments.flat().every(x=>Number.isFinite(x)&&x>=0)).toBe(true);
    for(const stage of Object.values(stages))expect(stage.worldMatricesColumnMajor.length).toBe(captureStageSnapshots===false?0:32);
    // Non-direct backend, including Z and rotated/translated parents: reuse the
    // same conversion as the directly writable buffer path. ik is pre-physics.
    if(captureStageSnapshots!==false)expect(inputs.at(-1)).toEqual(Array.from(new Float32Array(stages.ik.worldMatricesColumnMajor)));
    return {inputs,poses};
  };
  const reference=run();expect(run(false)).toEqual(reference);expect(run(false,true)).toEqual(reference);expect(run(true,true)).toEqual(reference);
});
