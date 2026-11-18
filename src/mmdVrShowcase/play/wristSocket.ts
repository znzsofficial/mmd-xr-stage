import { Vector3, type Object3D, type Bone, type SkinnedMesh, type Skeleton } from 'three';
import type { CharacterToy, Hand } from './stagePlay';

type Socket = { wrist: Bone; palm: Vector3 | null };
type Sockets = Partial<Record<Hand,Socket>>;
const cache = new WeakMap<Object3D,Sockets>();
const names = (bone:Bone) => [bone.userData.mmdBoneName,bone.name].filter((s):s is string=>typeof s==='string')
  .map(s=>s.normalize('NFKC').toLowerCase().split(':').pop()!.replace(/[\s_.-]/g,''));
const wristNames = {
  left: /^(左手首|左手腕?|lefthand|leftwrist|handleft|wristleft|handl|wristl|lhand|lwrist)$/,
  right: /^(右手首|右手腕?|righthand|rightwrist|handright|wristright|handr|wristr|rhand|rwrist)$/,
};
const fingerNames = /^(?:[左右](?:中指|人指|人差指|食指)1|(?:left|right)?(?:hand)?(?:middle|index)0?1(?:l|r|left|right)?)$/;

export function wristSockets(root:Object3D):Sockets {
  const known=cache.get(root);if(known)return known;
  const found:Sockets={},seen=new Set<Skeleton>();
  root.traverse(node=>{
    const mesh=node as SkinnedMesh, sk=mesh.skeleton;
    if(!mesh.isSkinnedMesh||!sk||seen.has(sk)||found.left&&found.right)return;
    seen.add(sk);
    for(const wrist of sk.bones){
      const labels=names(wrist);
      for(const hand of ['left','right'] as const){
        if(found[hand]||!labels.some(n=>wristNames[hand].test(n)))continue;
        const knuckle=wrist.children.find(b=>(b as Bone).isBone && names(b as Bone).some(n=>fingerNames.test(n)));
        found[hand]={wrist,palm:knuckle?.position.clone().multiplyScalar(.7)??null};
      }
    }
  });
  cache.set(root,found);return found;
}

/** The toy group lives in world space outside of the model's materials, physics and disposal tree.
 * Sample only the animated wrist chain, after the current displayed pose is committed. */
export function poseWristToy(group:Object3D,root:Object3D|null,prop:CharacterToy) {
  const socket=root?.visible && wristSockets(root)[prop.hand];
  if(!socket){group.visible=false;return;}
  const {wrist,palm}=socket;
  wrist.getWorldQuaternion(group.quaternion);
  if(palm)wrist.localToWorld(group.position.copy(palm));
  else {wrist.getWorldPosition(group.position);group.translateX(prop.hand==='left'?.052:-.052);}
  group.rotateX(prop.tilt*Math.PI/180);
  // Mesh origin is at the tool body; put the grip, rather than the muzzle, in the palm.
  group.translateY(.042);group.translateZ(.06+prop.inset*.01);group.visible=true;
}
