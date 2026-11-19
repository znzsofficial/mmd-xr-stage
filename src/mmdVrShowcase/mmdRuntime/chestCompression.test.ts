import {Bone,Skeleton,SkinnedMesh} from 'three';
import {expect,it} from 'vitest';
import {fitChestCompression} from './chestCompression';

it('compresses a contacted chest bone, releases smoothly, and never moves the arm chain',()=>{
  const m=new SkinnedMesh(),t=new Bone();t.name='上半身2';m.add(t);const bones=[t];
  for(const [s,k] of [['左',1],['右',-1]] as const){let p=t;
    for(const [n,x,y,z] of [['腕',k,0,0],['ひじ',k,-.4,.2],['手首',k,-.2,.2]] as const){const b=new Bone();b.name=s+n;b.position.set(x,y,z);p.add(b);bones.push(b);p=b;}}
  const c=new Bone();c.name='左胸';c.position.set(.75,-.72,.11);t.add(c);bones.push(c);m.updateMatrixWorld(true);m.bind(new Skeleton(bones));
  const pass=fitChestCompression(m)!;expect(pass.affectedBones).toEqual([c]);expect(pass.apply(0)).toBe(false);
  bones[2].rotation.y=Math.PI;m.updateMatrixWorld(true);const arms=bones.slice(1,7).map(b=>b.matrixWorld.clone());
  const rest=c.position.clone();expect(pass.apply(1/60)).toBe(true);const squeeze=c.position.distanceTo(rest);expect(squeeze).toBeGreaterThan(0);expect(c.scale.z).toBeLessThan(1);
  expect(bones.slice(1,7).map(b=>b.matrixWorld)).toEqual(arms);pass.restore();expect(c.position).toEqual(rest);
  bones[2].rotation.y=0;m.updateMatrixWorld(true);pass.apply(2/60);expect(c.position.distanceTo(rest)).toBeGreaterThan(0);expect(c.position.distanceTo(rest)).toBeLessThan(squeeze);
  for(let i=3;i<=120;i++){pass.restore();pass.apply(i/60);}expect(c.position).toEqual(rest);expect(c.scale.toArray()).toEqual([1,1,1]);
  c.name='accessory';expect(fitChestCompression(m)).toBeNull();
});
