import { Bone, BoxGeometry, Group, Mesh, Skeleton, SkinnedMesh, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { poseEggReceiver } from './eggSocket';

const close=(a:Vector3,b:Vector3)=>expect(a.distanceTo(b)).toBeLessThan(1e-6);
it('follows animated rolled hips, keeps centimetres physical, and scales the receiver with the actor',()=>{
  const root=new Group(),mesh=new SkinnedMesh(new BoxGeometry(3,16.5,2).translate(0,8.25,0)),hips=new Bone();
  hips.userData.mmdBoneName='下半身';hips.position.y=9;hips.rotation.z=.6;root.add(mesh);mesh.add(hips);
  root.updateMatrixWorld(true);mesh.bind(new Skeleton([hips]));
  root.position.set(2,-1,3);root.rotation.y=Math.PI/2;root.scale.setScalar(.1);
  const prop=new Group();poseEggReceiver(prop,root,[0,0,0]);expect(prop.visible).toBe(true);expect(prop.scale.x).toBeCloseTo(1);
  const p=prop.position.clone(),local=hips.worldToLocal(p.clone());
  poseEggReceiver(prop,root,[1,-2,3]);close(prop.position.clone().sub(p),new Vector3(.03,-.02,-.01));
  root.position.x+=2;hips.rotation.x=.7;hips.position.z=.5;root.scale.setScalar(.2);
  poseEggReceiver(prop,root,[0,0,0]);close(prop.position,hips.localToWorld(local));expect(prop.scale.x).toBeCloseTo(2);
  const base=prop.position.clone();poseEggReceiver(prop,root,[0,0,1]);expect(prop.position.distanceTo(base)).toBeCloseTo(.01);
  root.visible=false;poseEggReceiver(prop,root,[0,0,0]);expect(prop.visible).toBe(false);
});

it('fits a boneless actor with a nonzero mesh origin; movement, rotations and later scaling follow its root',()=>{
  const root=new Group(), body=new Mesh(new BoxGeometry(.4,1.65,.24));body.position.set(.5,1.825,-.7);root.add(body);
  const prop=new Group();poseEggReceiver(prop,root,[0,0,0]);
  close(prop.position,new Vector3(.5,1+.46*1.65,-.58));const local=prop.position.clone();
  root.position.set(9,2,-11);root.rotation.set(.4,-1,.2);root.scale.setScalar(.35);
  poseEggReceiver(prop,root,[0,0,0]);close(prop.position,root.localToWorld(local));expect(prop.scale.x).toBeCloseTo(.35);
  poseEggReceiver(prop,null,[0,0,0]);expect(prop.visible).toBe(false);
});
