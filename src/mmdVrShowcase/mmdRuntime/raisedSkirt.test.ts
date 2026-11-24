import {expect,it} from 'vitest';
import {Bone,BufferGeometry,Float32BufferAttribute,MeshBasicMaterial,Quaternion,Skeleton,SkinnedMesh,Uint16BufferAttribute,Vector3} from 'three';
import {fitRaisedSkirt} from './raisedSkirt';

// A hanging apron with authored chains, one rear chain and an independently
// skinned waist. Render the same weighted hem before/after the two knees rise.
function fixture(underBelt=false){
  const g=new BufferGeometry(),mesh=new SkinnedMesh(g,[new MeshBasicMaterial(),new MeshBasicMaterial()]),bones:Bone[]=[];
  const bone=(name:string,parent:number,x:number,y:number,z:number)=>{const b=new Bone();b.name=name;b.position.set(x,y,z);(bones[parent]??mesh).add(b);bones.push(b);return bones.length-1;};
  const pelvis=bone('pelvis',-1,0,0,0),hips=[bone('leftThigh',pelvis,.17,0,0),bone('rightThigh',pelvis,-.17,0,0)],knees=hips.map((h,i)=>bone(i?'rightKnee':'leftKnee',h,0,-1,0));
  const allowed=new Map<number,number>(),chains:number[][]=[];
  for(const [x,z] of [[-.17,.21],[0,.29],[.17,.21],[0,-.27]]){const chain=[bone('skirt',pelvis,x,.20,z)];for(let j=0;j<9;j++)chain.push(bone('fold',chain[j],0,-.052,0));chain.slice(0,-1).forEach(i=>allowed.set(i,3));chains.push(chain);}
  mesh.updateMatrixWorld(true);mesh.bind(new Skeleton(bones));const xyz:number[]=[],ix:number[]=[],ids:number[]=[],weights:number[]=[];
  const v=(x:number,y:number,z:number,i:number)=>{xyz.push(x,y,z);ids.push(i,0,0,0);weights.push(1,0,0,0);return xyz.length/3-1;};
  const belt=underBelt?.40:.18;ix.push(v(-.34,-.1,belt,pelvis),v(.34,-.1,belt,pelvis),v(-.34,.85,belt,pelvis),1,v(.34,.85,belt,pelvis),2);g.addGroup(0,6,0);
  const hem:number[]=[];for(const chain of chains){const i=chain.at(-2)!,p=bones[i].getWorldPosition(new Vector3());hem.push(v(p.x,p.y,p.z,i));}
  ix.push(hem[0],hem[1],hem[2]);g.addGroup(6,3,1);g.setIndex(ix);g.setAttribute('position',new Float32BufferAttribute(xyz,3));g.setAttribute('skinIndex',new Uint16BufferAttribute(ids,4));g.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
  const layer=fitRaisedSkirt(mesh,pelvis,hips,knees,allowed)!;expect(layer).toBeTruthy();
  function raise(){bones[pelvis].rotation.x=-Math.PI/2;hips.forEach((h,i)=>{bones[h].quaternion.copy(new Quaternion().setFromUnitVectors(new Vector3(0,-1,0),new Vector3(i?-.5:.5,.26,.82).normalize()));});mesh.updateMatrixWorld(true);}
  const read=()=>hem.map(i=>mesh.getVertexPosition(i,new Vector3()));return {mesh,bones,hips,knees,layer,raise,read};
}

it('carries only the contacted front onto the abdomen and restores both quaternions and translations before evaluation',()=>{
  const {mesh,bones,hips,knees,layer,raise,read}=fixture();raise();const start=read(),raw=bones.map(b=>[b.position.toArray(),b.quaternion.toArray()]),leg=[...hips,...knees].map(i=>bones[i].matrixWorld.clone());
  layer.seed(side=>side===0,[]);layer.present();expect(read()).toEqual(start);
  layer.seed(()=>true,[]);layer.present();const shown=read(),up=new Vector3(0,0,-1);
  expect(shown[1].clone().sub(start[1]).dot(up)).toBeGreaterThan(.16);expect(shown[3]).toEqual(start[3]);
  expect([...hips,...knees].map(i=>bones[i].matrixWorld)).toEqual(leg);
  layer.restore();expect(bones.map(b=>[b.position.toArray(),b.quaternion.toArray()])).toEqual(raw);expect(read()).toEqual(start);
  layer.present();expect(read()).toEqual(shown);layer.restore();mesh.material[0].visible=false;layer.present();expect(read()).toEqual(start);
  mesh.material[0].visible=true;layer.seed(()=>true,[]);layer.present();layer.clear();expect(read()).toEqual(start);
});

it('leaves a cage behind an independent outer waist and an upright skirt untouched',()=>{
  for(const buried of [true,false]){const {layer,read,raise}=fixture(buried);if(buried)raise();const raw=read();layer.seed(()=>true,[]);layer.present();expect(read()).toEqual(raw);}
});
