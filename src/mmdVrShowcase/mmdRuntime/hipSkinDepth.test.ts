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

it('keeps a dense two-sided surface snapshot valid as queries enter previously unvisited branches',()=>{
  const g=new BoxGeometry(1,.8,.7,8,8,8);g.clearGroups();g.addGroup(0,g.index!.count,0);
  const material=new MeshBasicMaterial(),mesh=new SkinnedMesh(g,material),left=new Bone(),right=new Bone();
  left.name='left thigh';right.name='right thigh';mesh.add(left,right);mesh.updateMatrixWorld(true);mesh.bind(new Skeleton([left,right]));
  const position=g.attributes.position,index=new Uint16Array(position.count*4),weight=new Float32Array(position.count*4);
  for(let i=0;i<position.count;i++){index[i*4]=position.getX(i)<0?0:1;weight[i*4]=1;}
  g.setAttribute('skinIndex',new Uint16BufferAttribute(index,4));g.setAttribute('skinWeight',new Float32BufferAttribute(weight,4));
  const depth=fitHipSkinDepth(mesh,material,[0,1],new Matrix4())!;
  // Further splits must use the original posed skin, even after the bones move.
  left.position.z=2;right.position.y=-2;mesh.updateMatrixWorld(true);
  for(const x of [-.475,.47,-.46,.49])for(const y of [-.23,.14]){
    const side=x<0?0:1,p=new Vector3(x,y,-.11);expect(depth(p,side)).toBeCloseTo(.5-Math.abs(x),7);expect(depth(p,1-side)).toBe(0);
  }
});
