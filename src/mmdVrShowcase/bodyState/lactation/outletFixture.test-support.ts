import { Bone, BufferGeometry, Float32BufferAttribute, Group, MeshBasicMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute } from 'three';

/** Two small triangulated skin patches and a separately weighted, movable cover. */
export function makeOutletFixture(){
  const root=new Group(), g=new BufferGeometry(), bones=['左胸','右胸','cloth'].map(name=>{const b=new Bone();b.name=name;return b;});
  const positions:number[]=[],normals:number[]=[],indices:number[]=[],joints:number[]=[],weights:number[]=[],deltas:number[]=[];
  function vertex(x:number,y:number,z:number,b:number,d:number){positions.push(x,y,z);normals.push(0,0,1);joints.push(b,0,0,0);weights.push(1,0,0,0);deltas.push(0,0,d);}
  for(let k=0;k<2;k++){
    const x=k===0?.10:-.10,base=positions.length/3;
    vertex(x,1.36,.12,k,.014);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;vertex(x+.012*Math.cos(a),1.36+.012*Math.sin(a),.118,k,.005);indices.push(base,base+1+i,base+1+(i+1)%8);}
  }
  g.addGroup(0,indices.length,0);
  const at=positions.length/3,lo=indices.length;
  for(const [x,y] of [[.075,1.33],[.125,1.33],[.1,1.40]])vertex(x,y,.133,2,0);
  indices.push(at,at+1,at+2);g.addGroup(lo,3,1);
  g.setIndex(indices);g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setAttribute('normal',new Float32BufferAttribute(normals,3));
  g.setAttribute('skinIndex',new Uint16BufferAttribute(joints,4));g.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
  g.morphTargetsRelative=true;g.morphAttributes.position=[new Float32BufferAttribute(deltas,3)];g.morphAttributes.position[0].name='nipple protrusion';
  const skin=new MeshBasicMaterial({color:0xdb9788}),cloth=new MeshBasicMaterial();skin.name='nipple';cloth.name='outer';cloth.visible=false;
  const mesh=new SkinnedMesh(g,[skin,cloth]);mesh.add(...bones);root.add(mesh);root.updateMatrixWorld(true);mesh.bind(new Skeleton(bones));
  return {model:{root,mesh,renderOrderMeshes:[]},bones,skin,cloth};
}
