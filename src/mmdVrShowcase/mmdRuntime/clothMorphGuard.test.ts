import {expect,it} from 'vitest';
import {BufferGeometry,Float32BufferAttribute,SkinnedMesh} from 'three';
import {clothMorphGuard} from './clothMorphGuard';

it('uses the drawn split channel indices as well as the corresponding logical source index',()=>{
  const source=new SkinnedMesh(),g=new BufferGeometry(),part=new SkinnedMesh(g),xyz=(xs:number[])=>new Float32BufferAttribute(xs,3);
  g.setAttribute('position',xyz([0,1,0, 0,2,0]));g.morphTargetsRelative=true;
  g.morphAttributes.position=[xyz([0,0,0, .4,0,0]),xyz([0,0,.2, 0,0,0])];part.updateMorphTargets();
  source.morphTargetInfluences=[0,0,0,0];part.userData.mmdMorphSplitBody={morphTargetIndices:[3,1]};
  const guard=clothMorphGuard(source,new Map([[part,new Set([0])]]),new Set([part]));
  source.morphTargetInfluences[3]=part.morphTargetInfluences![0]=1;expect(guard.blocked()).toBe(false);
  source.morphTargetInfluences[1]=.2;expect(guard.blocked()).toBe(true);
  source.morphTargetInfluences[1]=0;part.morphTargetInfluences![1]=.2;expect(guard.blocked()).toBe(true);
  part.morphTargetInfluences![1]=0;expect(guard.blocked()).toBe(false);
  part.userData.mmdMorphSplitBody.morphTargetIndices=[9];expect(guard.blocked()).toBe(true);
});
