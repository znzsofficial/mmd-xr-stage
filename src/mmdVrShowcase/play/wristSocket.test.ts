import { Bone, Group, SkinnedMesh, Skeleton, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { poseWristToy, wristSockets } from './wristSocket';

it('puts the handle in the animated palm in metres, even under scaled and rotated model roots',()=>{
  const root=new Group(),mesh=new SkinnedMesh(),wrist=new Bone(),finger=new Bone(),helper=new Bone();
  root.add(mesh);mesh.add(helper,wrist);wrist.add(finger);mesh.bind(new Skeleton([helper,wrist,finger]));
  wrist.userData.mmdBoneName='右手首';finger.name='右中指１';helper.name='左手首捩';
  finger.position.set(-1,0,0);root.position.set(1,2,-3);root.scale.setScalar(.095);root.rotation.y=1.2;
  expect(wristSockets(root).left).toBeUndefined();const prop=new Group();
  for(const angle of [0,.3,1.5]){
    wrist.rotation.z=angle;poseWristToy(prop,root,{toy:'post',assetId:'a',hand:'right',tilt:15,inset:0});
    expect(prop.localToWorld(new Vector3(0,-.042,-.06)).distanceTo(wrist.localToWorld(new Vector3(-.7,0,0)))).toBeLessThan(1e-6);
  }
  root.visible=false;poseWristToy(prop,root,{toy:'post',assetId:'a',hand:'right',tilt:0,inset:0});expect(prop.visible).toBe(false);
});
