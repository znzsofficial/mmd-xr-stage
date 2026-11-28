import type Rapier from '@dimforge/rapier3d-compat';
import {Matrix4,Vector3,type BufferGeometry,type InstancedMesh,type Object3D} from 'three';

type Triangles={positions:Float32Array|Float64Array; indices:Uint32Array};
type Surface={triangles:Triangles; matrix:Matrix4};

function matches(previous:Triangles,g:BufferGeometry,start:number,length:number){
  const p=g.attributes.position,i=g.index,{positions,indices}=previous;
  if(positions.length!==p.count*3||indices.length!==length)return false;
  for(let j=0;j<p.count;j++){
    if(positions[3*j]!==p.getX(j)||positions[3*j+1]!==p.getY(j)||positions[3*j+2]!==p.getZ(j))return false;
  }
  for(let k=0;k<length;k++)if(indices[k] !== (i?i.getX(start+k):start+k))return false;
  return true;
}

// These are CPU collision inputs. setXYZ, direct index writes and setMatrixAt
// need not bump a GPU upload version. Check each prop's local geometry on
// a roster publication, never per instance, eye or walking frame.
function localTriangles(g:BufferGeometry,previous:Triangles|null|undefined):Triangles|null {
  const p=g.attributes.position,i=g.index;
  if(!p)return null;
  const start=g.drawRange.start,end=Math.min(i?.count??p.count,start+g.drawRange.count);
  const length=Math.floor((end-start)/3)*3;
  if(length<=0)return null;
  if(previous&&matches(previous,g,start,length))return previous;
  // Keep decoded integer/normalized and double-precision coordinates intact
  // until the world transform. Rapier takes Float32 only after that transform.
  const positions=p.array instanceof Float32Array&&!p.normalized?new Float32Array(p.count*3):new Float64Array(p.count*3);
  for(let j=0;j<p.count;j++){
    positions[3*j]=p.getX(j);positions[3*j+1]=p.getY(j);positions[3*j+2]=p.getZ(j);
  }
  const indices=Uint32Array.from({length},(_,k)=>i?i.getX(start+k):start+k);
  return {positions,indices};
}

/** Owned by one mounted prop in one walking world, including its instances. */
export function createPlanetPropSolids(rapier:typeof Rapier,world:Rapier.World,root:Object3D){
  let body:Rapier.RigidBody|null=null;
  let geometries=new Map<BufferGeometry,Triangles|null>(),surfaces:Surface[]=[];

  function update(){
    const nextGeometry=new Map<BufferGeometry,Triangles|null>(),next:Surface[]=[];
    root.updateWorldMatrix(true,true);
    root.traverseVisible(o=>{
      const mesh=o as InstancedMesh;
      if(!mesh.isMesh||(mesh.isInstancedMesh&&mesh.count===0))return;
      const g=mesh.geometry;
      if(!nextGeometry.has(g))nextGeometry.set(g,localTriangles(g,geometries.get(g)));
      const triangles=nextGeometry.get(g);
      if(!triangles)return;
      for(let k=0;k<(mesh.isInstancedMesh?mesh.count:1);k++){
        const matrix=new Matrix4();
        if(mesh.isInstancedMesh){mesh.getMatrixAt(k,matrix);matrix.premultiply(mesh.matrixWorld);}
        else matrix.copy(mesh.matrixWorld);
        next.push({triangles,matrix});
      }
    });
    if(next.length===surfaces.length&&next.every(({triangles,matrix},i)=>triangles===surfaces[i].triangles&&matrix.equals(surfaces[i].matrix))){
      geometries=nextGeometry;return;
    }
    const fixed=next.length?world.createRigidBody(rapier.RigidBodyDesc.fixed()):null;
    if(fixed){
      const v=new Vector3();
      try{
        for(const {triangles:{positions,indices},matrix} of next){
          const vertices=new Float32Array(positions.length);
          for(let j=0;j<vertices.length;j+=3)v.fromArray(positions,j).applyMatrix4(matrix).toArray(vertices,j);
          world.createCollider(rapier.ColliderDesc.trimesh(vertices,indices),fixed);
        }
      }catch(error){world.removeRigidBody(fixed);throw error;}
    }
    if(body?.isValid())world.removeRigidBody(body);
    body=fixed;geometries=nextGeometry;surfaces=next;
  }
  function dispose(){
    if(body?.isValid())world.removeRigidBody(body);
    body=null;geometries.clear();surfaces=[];
  }
  return {update,dispose};
}
