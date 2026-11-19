import { Bone, Group, Skeleton, SkinnedMesh } from 'three';
import { DefaultMmdRuntime, MmdAnimRuntime } from '@yohawing/three-mmd-loader/runtime';
import { expect, it, vi } from 'vitest';

it.each(['js','wasm'])('%s render sync honors distinct bind inverses and live proxy rebinding',path=>{
  const root=new Group(),nested=new Group(),bone=new Bone();root.add(nested,bone);
  const a=new Skeleton([bone]);bone.position.x=1;root.updateMatrixWorld(true);const b=new Skeleton([bone]);
  const skins=[a,a,b,b].map(s=>{const mesh=new SkinnedMesh();mesh.skeleton=s;nested.add(mesh);return mesh;});
  const ua=vi.spyOn(a,'update'),ub=vi.spyOn(b,'update');
  // Drive the render pass independent of a VMD: both runtimes expose tick.
  const js=new DefaultMmdRuntime();const tick=()=>path==='js'?js.tick(0,{mesh:root}):MmdAnimRuntime.prototype.tick.call({evaluate:()=>({})} as never,0,root);
  bone.position.x=3;tick();expect(ua).toHaveBeenCalledTimes(1);expect(ub).toHaveBeenCalledTimes(1);
  expect(a.boneMatrices![12]).toBe(3);expect(b.boneMatrices![12]).toBe(2);
  for(const mesh of skins)mesh.skeleton=b;
  bone.position.x=6;tick();expect(ua).toHaveBeenCalledTimes(1);expect(ub).toHaveBeenCalledTimes(2);expect(b.boneMatrices![12]).toBe(5);
});
