import {Bone, BufferGeometry, Float32BufferAttribute, Group, MeshBasicMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3} from 'three';

/** Four independently measurable face points, in a compact material mesh
 * whose local channel order deliberately differs from the VMD source. */
export function faceFixture(root=new Group(),names=['Blink','MouthOpen','なごみ','Smile']){
  const geom=()=>{
    const g=new BufferGeometry();g.morphTargetsRelative=true;
    g.setAttribute('position',new Float32BufferAttribute([-.04,.05,0, .02,0,0, .04,.05,0, -.02,0,0],3));
    g.setAttribute('skinIndex',new Uint16BufferAttribute(new Uint16Array(16),4));
    g.setAttribute('skinWeight',new Float32BufferAttribute([1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],4));
    g.setIndex([0,1,2,0,3,1]);return g;
  };
  const material=new MeshBasicMaterial(),mesh=new SkinnedMesh(geom(),material),bone=new Bone();
  root.add(mesh);mesh.add(bone);mesh.bind(new Skeleton([bone]));mesh.geometry.setDrawRange(0,0);
  mesh.morphTargetDictionary=Object.fromEntries(names.map((s,i)=>[s,i]));mesh.morphTargetInfluences=names.map(()=>0);
  mesh.userData.mmdMorphs=names.map(name=>({type:'vertex',name}));
  const indices=names.map((_,i)=>(i+2)%names.length),g=geom();
  g.morphAttributes.position=indices.map(i=>{const a=new Float32Array(12);a[(i%4)*3+2]=.1;return new Float32BufferAttribute(a,3);});
  const body=new SkinnedMesh(g,material);root.add(body);body.bind(mesh.skeleton,mesh.bindMatrix);
  body.userData.mmdMorphSplitBody={morphTargetIndices:Uint16Array.from(indices)};mesh.userData.mmdMorphSplitBodyMeshes=[body];
  root.updateMatrixWorld(true);
  return {root,mesh,body,bone,renderOrderMeshes:[],z:(i:number)=>body.getVertexPosition(i,new Vector3()).z,
    dispose(){mesh.geometry.dispose();g.dispose();material.dispose();mesh.skeleton.dispose();}};
}
