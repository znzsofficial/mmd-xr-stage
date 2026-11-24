import {Quaternion,Vector3,type Bone,type SkinnedMesh} from 'three';

const heads=new WeakMap<SkinnedMesh,{bone:Bone;right:Vector3}|null>();
function bind(mesh:SkinnedMesh){
  if(heads.has(mesh))return heads.get(mesh);
  const index=mesh.skeleton.bones.findIndex(b=>[b.name,b.userData.mmdEnglishBoneName,b.userData.mmdBoneName].some(n=>typeof n==='string'&&/^(頭|头|head)$/i.test(n.trim())));
  const bone=mesh.skeleton.bones[index],inverse=mesh.skeleton.boneInverses[index];
  const result=bone&&inverse?{bone,right:new Vector3(1,0,0).transformDirection(mesh.bindMatrix).transformDirection(inverse)}:null;
  heads.set(mesh,result);return result;
}

/** A small additive pitch around the actor's bind-space right, including a
 * held supine pose. Never drive the torso, contact frame, IK or cloth. */
export function contactHead(){
  const raw=new Quaternion(),delta=new Quaternion();let current:Bone|null=null;
  function restore(){if(current){current.quaternion.copy(raw);current.updateMatrixWorld(true);current=null;}}
  return {restore,apply(mesh:SkinnedMesh,pitch:number){
    const head=bind(mesh);if(!head||Math.abs(pitch)<1e-5)return;
    current=head.bone;raw.copy(current.quaternion);current.quaternion.multiply(delta.setFromAxisAngle(head.right,pitch));current.updateMatrixWorld(true);
  }};
}
