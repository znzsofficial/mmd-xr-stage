import {Bone,SkinnedMesh,Skeleton} from 'three';
import {describe,it,expect} from 'vitest';
import {installActorPalms} from './actorPalms';

function fixture(){const mesh=new SkinnedMesh(),bones=['右手首','右人指１','右小指１'].map((name,i)=>{
  const b=new Bone();b.name=name;b.userData.mmdRestPosition=i===0?[0,0,0]:[i===1?-.35:.35,1,0];return b;});bones[0].add(...bones.slice(1));mesh.add(bones[0]);mesh.bind(new Skeleton(bones));
  const original=[{name:'skirt',mode:'dynamic',mask:97,group:6,boneIndex:-1},{name:'earring',mode:'dynamic',mask:65535,group:6,boneIndex:-1}];
  mesh.userData.mmdPhysics={rigidBodies:original,joints:[]};return {mesh,original};}

describe('optional actor palm contact',()=>{
  it('adds only the missing palm and filters other dynamic bodies even if they share the skirt group',()=>{
    const {mesh,original}=fixture();expect(installActorPalms(mesh)).toBe(1);const [skirt,ear,palm]=mesh.userData.mmdPhysics.rigidBodies;
    expect(palm.boneIndex).toBe(0);expect(palm.mask).toBe(1<<6);expect(skirt.mask&(1<<palm.group)).not.toBe(0);expect(ear.mask&(1<<palm.group)).toBe(0);expect(original[1].mask).toBe(65535);expect(installActorPalms(mesh)).toBe(0);
  });
  it('does not double authored finger collisions or fit unrecognised hands',()=>{
    const {mesh,original}=fixture();original[1].boneIndex=2;expect(installActorPalms(mesh)).toBe(0);original[1].boneIndex=-1;mesh.skeleton.bones[2].name='other';expect(installActorPalms(mesh)).toBe(0);expect(mesh.userData.mmdPhysics.rigidBodies).toBe(original);
  });
  it('leaves enough groups for real XR inputs and refuses flattened/degenerate finger geometry',()=>{
    const {mesh,original}=fixture();original.push(...Array.from({length:14},(_,group)=>({...original[1],group})));expect(installActorPalms(mesh)).toBe(0);original.splice(2);mesh.skeleton.bones[1].userData.mmdRestPosition=[0,0,0];mesh.skeleton.bones[2].userData.mmdRestPosition=[0,0,0];expect(installActorPalms(mesh)).toBe(0);
  });
});
