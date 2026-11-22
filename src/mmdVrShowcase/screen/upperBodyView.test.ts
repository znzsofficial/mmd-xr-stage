import {Bone,Group,SkinnedMesh,Skeleton,Vector3,PerspectiveCamera} from 'three';
import {expect,it} from 'vitest';
import {upperBodyView} from './upperBodyView';

it('frames a seated and rotated chest in a narrow viewing area, not the standing catalog bounds',()=>{
  const root=new Group(),mesh=new SkinnedMesh(),keys=['左胸','右胸','左腕','右腕','首','下半身'];
  const bones=keys.map((name,i)=>{const b=new Bone();b.name=name;b.position.set([.1,-.1,.18,-.18,0,0][i],[.83,.83,1,1,1.07,.49][i],i<2?.13:0);return b;});
  root.position.set(5,2,-3);root.rotation.y=Math.PI*.8;root.scale.setScalar(.8);root.add(mesh);mesh.add(...bones);root.updateMatrixWorld(true);mesh.bind(new Skeleton(bones));
  const camera=new PerspectiveCamera(40,.55,.03,100);
  const {target,eye}=upperBodyView(root,{position:[5,2,-3],visible:true,runtimeId:'r',bounds:{center:[5,2.8,-3],size:[1,1.6,.5]}},camera.aspect);
  expect(target.distanceTo(bones[0].getWorldPosition(new Vector3()).lerp(bones[1].getWorldPosition(new Vector3()),.5))).toBeLessThan(1e-8);
  camera.position.copy(eye);camera.lookAt(target);camera.updateMatrixWorld();
  for(const b of bones.slice(0,2)){const p=b.getWorldPosition(new Vector3()).project(camera);expect(Math.abs(p.x)).toBeLessThan(.95);expect(Math.abs(p.x)).toBeGreaterThan(.2);}
  expect(eye.clone().sub(target).dot(new Vector3(0,0,1).transformDirection(root.matrixWorld))).toBeGreaterThan(0);
});
