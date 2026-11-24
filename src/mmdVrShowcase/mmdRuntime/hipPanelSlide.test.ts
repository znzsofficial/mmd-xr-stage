import {expect,it} from 'vitest';
import {Bone,BufferGeometry,Float32BufferAttribute,Matrix4,MeshBasicMaterial,Skeleton,SkinnedMesh,Uint16BufferAttribute,Vector3} from 'three';
import {fitHipPanelSlide} from './hipPanelSlide';

it('slides a crossing skirt strip with its lining; a cached pass restores the same skinned geometry without another contact query',()=>{
  const g=new BufferGeometry(),mesh=new SkinnedMesh(g,[new MeshBasicMaterial(),new MeshBasicMaterial()]);
  const bones:Bone[]=[],columns=[];
  for(const angle of [.94,1.19,1.44]){const links=[];for(let j=0;j<4;j++){
    const b=new Bone();(j?links[j-1].bone:mesh).add(b);bones.push(b);links.push({bone:b});}
    columns.push({angle,side:0,links});}
  mesh.updateMatrixWorld(true);mesh.bind(new Skeleton(bones));
  const xyz=[.20,.24,.20,.33,.27,.15,.40,.24,.06,.20,.24,.20,.33,.27,.15,.40,.24,.06];
  g.setAttribute('position',new Float32BufferAttribute(xyz,3));g.setAttribute('skinIndex',new Uint16BufferAttribute([3,7,11,3,7,11].flatMap(i=>[i,0,0,0]),4));
  g.setAttribute('skinWeight',new Float32BufferAttribute(Array.from({length:6},()=>[1,0,0,0]).flat(),4));g.setIndex([0,1,2,3,4,5]);g.addGroup(0,3,0);g.addGroup(3,3,1);
  const vertices=()=>xyz.filter((_,i)=>i%3===0).map((_,i)=>mesh.getVertexPosition(i,new Vector3()));
  const slide=fitHipPanelSlide(mesh,columns,new Matrix4()),I=new Matrix4(),plane=.25;let calls=0,admit=true;
  const skin={depth:(p:Vector3)=>Math.max(0,plane-p.y),field:{clearance(p:Vector3,n:Vector3){calls++;n.set(0,1,0);return plane-p.y;}},
    crossing:{crosses(a:Vector3,b:Vector3,c:Vector3){return admit&&Math.min(a.y,b.y,c.y)<plane&&Math.max(a.y,b.y,c.y)>plane;}},toLap:I,toLocal:I,length:1};
  const raw=vertices();slide(I,I,[skin],false);const shifted=vertices();expect(shifted.every(p=>p.y>plane)).toBe(true);
  expect(shifted[0].distanceTo(shifted[1])).toBeCloseTo(raw[0].distanceTo(raw[1]),6);expect(shifted.slice(0,3)).toEqual(shifted.slice(3));
  expect(columns.every(c=>c.links[0].bone.position.lengthSq()===0)).toBe(true);
  const reset=()=>{for(const b of bones)b.position.set(0,0,0);mesh.updateMatrixWorld(true);};reset();const n=calls;slide(I,I,[skin],true);expect(calls).toBe(n);expect(vertices()).toEqual(shifted);
  reset();admit=false;slide(I,I,[{...skin}],false);expect(vertices()).toEqual(raw);
  // A layer can lose all its crossings yet gain a deeper point. Use the
  // separately computed interior depth as a veto for the entire side.
  admit=true;const deeper={...skin,depth:(p:Vector3)=>p.y>.28?.08:0};
  slide(I,I,[deeper],false);expect(vertices()).toEqual(raw);
});
