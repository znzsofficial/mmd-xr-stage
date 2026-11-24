import {expect,it} from 'vitest';
import {Bone,BoxGeometry,Float32BufferAttribute,Matrix4,MeshBasicMaterial,Skeleton,SkinnedMesh,Uint16BufferAttribute,Vector3} from 'three';
import {fitHipSkinDepth} from './hipSkinDepth';

it('measures the distance to actual thigh faces, rejecting the other side, an open skin and the wrong draw',()=>{
  const g=new BoxGeometry(.5,1,.4);g.clearGroups();g.addGroup(0,g.index!.count,0);
  const m=new MeshBasicMaterial(),mesh=new SkinnedMesh(g,m),a=new Bone(),b=new Bone();a.name='left thigh';b.name='right thigh';mesh.add(a,b);mesh.updateMatrixWorld(true);mesh.bind(new Skeleton([a,b]));
  g.setAttribute('skinIndex',new Uint16BufferAttribute(new Uint16Array(g.attributes.position.count*4),4));
  g.setAttribute('skinWeight',new Float32BufferAttribute(Array.from({length:g.attributes.position.count},()=>[1,0,0,0]).flat(),4));
  const I=new Matrix4(),p=new Vector3(.01,-.06,.12),fit=()=>fitHipSkinDepth(mesh,m,[0,1],I)!;const d=fit();
  expect(d(p,0)).toBeCloseTo(.08,5);expect(d.upper(p)).toBeGreaterThanOrEqual(d(p,0));expect(d(p,1)).toBe(0);expect(d(new Vector3(.3,0,0),0)).toBe(0);
  expect(fitHipSkinDepth(mesh,new MeshBasicMaterial(),[0,1],I)).toBeNull();g.clearGroups();g.addGroup(0,24,0);expect(fit()(p,0)).toBe(0);
});
