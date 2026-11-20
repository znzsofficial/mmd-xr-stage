import { Bone, Group, SkinnedMesh, Skeleton, Vector3 } from 'three';
import {shelfToys,TOYS} from './propCatalog';
import { expect, it } from 'vitest';
import { poseWristToy, wristSockets } from './wristSocket';

it('puts the handle in the animated palm in metres, even under scaled and rotated model roots',()=>{
  const root=new Group(),mesh=new SkinnedMesh(),wrist=new Bone(),finger=new Bone(),helper=new Bone();
  root.add(mesh);mesh.add(helper,wrist);wrist.add(finger);mesh.bind(new Skeleton([helper,wrist,finger]));
  wrist.userData.mmdBoneName='右手首';finger.name='右中指１';helper.name='左手首捩';
  finger.position.set(-1,0,0);root.position.set(1,2,-3);root.scale.setScalar(.095);root.rotation.y=1.2;
  expect(wristSockets(root).left).toBeUndefined();const prop=new Group();
  for(const angle of [0,.3,1.5]){
    wrist.rotation.z=angle;poseWristToy(prop,root,{toy:'post',assetId:'a',hand:'right',tilt:15,inset:0,turn:0});
    expect(prop.localToWorld(new Vector3(...TOYS.post.grip.point)).distanceTo(wrist.localToWorld(new Vector3(-.7,0,0)))).toBeLessThan(1e-6);
  }
  root.visible=false;poseWristToy(prop,root,{toy:'post',assetId:'a',hand:'right',tilt:0,inset:0,turn:0});expect(prop.visible).toBe(false);
});

it('points the muzzle toward the knuckles on mirrored, rolled wrists and keeps each handle anchored while tilting',()=>{
  for(const hand of ['left','right'] as const){
    const root=new Group(),mesh=new SkinnedMesh(),w=new Bone(),side=hand==='left'?1:-1;root.add(mesh);mesh.add(w);w.name=hand+'Hand';w.rotation.set(.44,side*.71,-.37);
    const bs=[w];for(const [i,name] of ['Index','Middle','Pinky'].entries()){const f=new Bone();f.name=hand+'Hand'+name+'1';w.add(f);f.position.set(side,0,(1-i)*.35).applyQuaternion(w.quaternion.clone().invert());bs.push(f);}
    root.updateMatrixWorld(true);mesh.bind(new Skeleton(bs));root.scale.setScalar(.12);root.rotation.y=.8;w.rotateZ(.67);
    const pole=bs[2].getWorldPosition(new Vector3()).sub(w.getWorldPosition(new Vector3())).normalize();
    const thumb=bs[1].getWorldPosition(new Vector3()).sub(bs[3].getWorldPosition(new Vector3())).normalize();
    const group=new Group(),center=w.localToWorld(wristSockets(root)[hand]!.palm!.clone());
    for(const toy of shelfToys){for(const tilt of [0,30]){
      poseWristToy(group,root,{toy,hand,assetId:'a',inset:0,tilt,turn:tilt?180:0});
      expect(group.localToWorld(new Vector3(...TOYS[toy].grip.point)).distanceTo(center)).toBeLessThan(1e-6);
      if(toy==='bubbles'&&!tilt){expect(new Vector3(0,0,-1).applyQuaternion(group.quaternion).dot(pole)).toBeCloseTo(1);expect(new Vector3(0,1,0).applyQuaternion(group.quaternion).dot(thumb)).toBeCloseTo(1);}
    }}
  }
});
