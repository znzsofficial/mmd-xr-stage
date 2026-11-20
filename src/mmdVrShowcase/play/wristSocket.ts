import { Matrix4, Quaternion, Vector3, type Object3D, type Bone, type SkinnedMesh, type Skeleton } from 'three';
import type { CharacterToy, Hand } from './stagePlay';
import {TOYS} from './propCatalog';

type Socket = { wrist: Bone; palm: Vector3 | null; basis:Quaternion };
type Sockets = Partial<Record<Hand,Socket>>;
const cache = new WeakMap<Object3D,Sockets>();
const names = (bone:Bone) => [bone.userData.mmdBoneName,bone.userData.mmdEnglishBoneName,bone.name].filter((s):s is string=>typeof s==='string')
  .map(s=>s.normalize('NFKC').toLowerCase().split(':').pop()!.replace(/[\s_.-]/g,'').replace(/^mixamorig/,''));
const wristNames = {
  left: /^(左手首|左手腕?|lefthand|leftwrist|handleft|wristleft|handl|wristl|lhand|lwrist)$/,
  right: /^(右手首|右手腕?|righthand|rightwrist|handright|wristright|handr|wristr|rhand|rwrist)$/,
};
const fingerNames = [/中指1$|middle(?:finger)?0?1(?:l|r|left|right)?$/,/(?:人指|人差指|食指)1$|index(?:finger)?0?1(?:l|r|left|right)?$/, /小指1$|(?:pinky|little)(?:finger)?0?1(?:l|r|left|right)?$/];

function fitSocket(sk:Skeleton,wrist:Bone,hand:Hand):Socket{
  const inv=sk.boneInverses[sk.bones.indexOf(wrist)],knuckles:(Vector3|undefined)[]=[];
  wrist.traverse(node=>{
    const b=node as Bone;if(!b.isBone||b===wrist)return;
    const labels=names(b),i=fingerNames.findIndex(regex=>labels.some(n=>regex.test(n)));
    if(i<0||knuckles[i])return;
    const bind=sk.boneInverses[sk.bones.indexOf(b)];
    const v=inv&&bind?new Vector3().setFromMatrixPosition(bind.clone().invert()).applyMatrix4(inv):new Vector3();
    if(v.lengthSq()<1e-12&&b.parent===wrist)v.copy(b.position);
    if(v.lengthSq()>1e-12)knuckles[i]=v;
  });
  const [middle,index,little]=knuckles,edgeA=index??middle,edgeB=little??middle;
  const palm=middle?.clone()??(index&&little?index.clone().lerp(little,.5):index?.clone()??little?.clone())??null;
  const basis=new Quaternion();
  const parentBind=wrist.parent&&sk.boneInverses[sk.bones.indexOf(wrist.parent as Bone)];
  const forearm=inv&&parentBind?new Vector3().setFromMatrixPosition(parentBind.clone().invert()).applyMatrix4(inv).negate():null;
  const forward=palm??forearm;
  if(forward&&forward.lengthSq()>1e-12){
    const back=forward.clone().normalize().negate(),up=edgeA&&edgeB?edgeA.clone().sub(edgeB):new Vector3();
    // With just one knuckle choose a bind-model vertical reference, not the
    // animated camera up. All three axes then travel with this wrist forever.
    up.addScaledVector(back,-up.dot(back));
    if(up.lengthSq()<1e-10){up.set(0,1,0);if(inv)up.transformDirection(inv);if(Math.abs(up.dot(back))>.95){up.set(0,0,1);if(inv)up.transformDirection(inv);}up.addScaledVector(back,-up.dot(back));}
    up.normalize();const side=up.clone().cross(back).normalize();
    basis.setFromRotationMatrix(new Matrix4().makeBasis(side,back.clone().cross(side),back));
    palm?.multiplyScalar(.70);
    if(index&&little)palm?.addScaledVector(side,(hand==='left'?1:-1)*index.distanceTo(little)*.18);
  }else if(inv){
    // Wrist-only skeleton: normalize its arbitrary bind-axis roll first.
    basis.setFromRotationMatrix(new Matrix4().extractRotation(inv));
  }
  return {wrist,palm,basis};
}

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
        found[hand]=fitSocket(sk,wrist,hand);
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
  wrist.getWorldQuaternion(group.quaternion).multiply(socket.basis);
  if(palm)wrist.localToWorld(group.position.copy(palm));
  else {wrist.getWorldPosition(group.position);group.translateZ(-.045);}
  const grip=TOYS[prop.toy].grip;
  group.rotateY(prop.turn*Math.PI/180);group.rotateX(grip.pitch+prop.tilt*Math.PI/180);
  // Mesh origin is at the tool body; put the grip, rather than the muzzle, in the palm.
  group.translateX(-grip.point[0]);group.translateY(-grip.point[1]);group.translateZ(-grip.point[2]+prop.inset*.01);group.visible=true;
}
