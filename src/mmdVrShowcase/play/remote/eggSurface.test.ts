import {Bone,Float32BufferAttribute,Group,MeshBasicMaterial,PlaneGeometry,Skeleton,SkinnedMesh,Uint16BufferAttribute,Vector3} from 'three';
import {expect,it} from 'vitest';
import {createEggSurface} from './eggSurface';

it('sits on the drawn outer panel at chest and waist, follows its bone, and unwinds only the contacted patch',()=>{
  const root=new Group(),geometry=new PlaneGeometry(.6,1.7,24,64).translate(0,.85,0),p=geometry.attributes.position;
  geometry.setAttribute('skinIndex',new Uint16BufferAttribute(new Uint16Array(p.count*4),4));
  const weights=new Float32Array(p.count*4);for(let i=0;i<p.count;i++)weights[i*4]=1;
  geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
  const mat=new MeshBasicMaterial(),mesh=new SkinnedMesh(geometry,mat),bone=new Bone();mesh.add(bone);root.add(mesh);mesh.bind(new Skeleton([bone]));
  const coat=mesh.clone(false);coat.geometry=geometry.clone().translate(0,0,.08);coat.material=mat.clone();coat.bind(mesh.skeleton,mesh.bindMatrix);root.add(coat);
  mesh.userData.mmdMorphSplitBodyMeshes=[mesh,coat];root.updateMatrixWorld(true);
  const source=createEggSurface({root,mesh,renderOrderMeshes:[]}),out=new Group(),outer=coat.geometry.attributes.position,rest=outer.array.slice();
  for(const site of ['cloth','chest'] as const){
    expect(source.pose(out,site,[0,0,0],1,0)).toBe(true);expect(out.position.z).toBeGreaterThan(.08);
    const baseline=out.position.clone();source.pose(out,site,[0,0,0],1,1);source.apply(1);
    let changed=0;for(let i=0;i<p.count;i++)if(outer.getY(i)!==rest[3*i+1]){changed++;expect(Math.abs(outer.getY(i)-baseline.y)).toBeLessThan(.12);}
    expect(changed).toBeGreaterThan(4);expect(changed).toBeLessThan(p.count/8);expect(out.position.distanceTo(baseline)).toBeGreaterThan(.01);
    source.restore();expect(outer.array).toEqual(rest);
    bone.rotation.z=.8;root.updateMatrixWorld(true);source.pose(out,site,[0,0,0],1,0);
    expect(out.position.distanceTo(baseline.applyQuaternion(bone.quaternion))).toBeLessThan(.00001);
    bone.rotation.z=0;root.updateMatrixWorld(true);source.pose(out,site,[0,0,10],1,1);source.apply(1);expect(source.touching).toBe(false);expect(outer.array).toEqual(rest);
    coat.visible=false;source.pose(out,site,[0,0,0],1,0);expect(out.position.z).toBeLessThan(.02);coat.visible=true;
  }
  expect(new Vector3().fromBufferAttribute(p,0).z).toBe(0);
});
