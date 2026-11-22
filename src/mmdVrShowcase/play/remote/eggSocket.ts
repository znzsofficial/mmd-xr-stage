import { Box3, Matrix4, Quaternion, Vector3, type Bone, type Mesh, type Object3D, type Skeleton, type SkinnedMesh } from 'three';
import type { EggOffset } from './remoteMotor';

const typicalHeight=1.65;
type Socket={anchor:Object3D; localPoint:Vector3; localAxes:Quaternion; size:number};
const sockets=new WeakMap<Object3D,Socket>();
const normalized=(s:string)=>s.normalize('NFKC').toLowerCase().split(':').pop()!.replace(/[\s_.-]/g,'').replace(/^mixamorig/,'');
const matches=(b:Bone,re:RegExp)=>[b.userData.mmdBoneName,b.userData.mmdEnglishBoneName,b.name].some(n=>typeof n==='string'&&re.test(normalized(n)));

/** Rest-mesh bounds in actor space, never current animated vertices or world Y. */
function actorBounds(root:Object3D) {
  const bounds=new Box3(), inverse=root.matrixWorld.clone().invert(), rel=new Matrix4(), box=new Box3();
  root.traverse(o=>{
    const m=o as Mesh;if(!m.isMesh||!m.geometry?.getAttribute('position'))return;
    if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();
    if(m.geometry.boundingBox)bounds.union(box.copy(m.geometry.boundingBox).applyMatrix4(rel.multiplyMatrices(inverse,m.matrixWorld)));
  });
  if(bounds.isEmpty()||!Number.isFinite(bounds.max.y-bounds.min.y)||bounds.max.y<=bounds.min.y)
    bounds.set(new Vector3(-.23,0,-.12),new Vector3(.23,typicalHeight,.12));
  return bounds;
}

function fit(root:Object3D):Socket {
  root.updateWorldMatrix(true,true);
  const bounds=actorBounds(root), height=bounds.max.y-bounds.min.y;
  let fitted:Socket|undefined;
  const seen=new Set<Skeleton>();
  root.traverse(o=>{
    const mesh=o as SkinnedMesh,sk=mesh.skeleton;
    if(fitted||!mesh.isSkinnedMesh||!sk||seen.has(sk)||sk.bones.length!==sk.boneInverses.length)return;
    seen.add(sk);
    const find=(re:RegExp)=>sk.bones.findIndex(b=>matches(b,re));
    let hip=find(/^(下半身|hips?|pelvis|lowerbody|骨盆|骨盘)$/);
    if(hip<0)hip=find(/^(腰|waist)$/);
    if(hip<0)return;
    const rest=(i:number)=>new Vector3().setFromMatrixPosition(sk.boneInverses[i].clone().invert());
    const head=find(/^(頭|头|head)$/), foot=find(/^(左足首|右足首|左脚踝|右脚踝|(?:left|right)(?:ankle|foot)|(?:ankle|foot)[lr])$/);
    const stature=head>=0&&foot>=0?Math.abs(rest(head).y-rest(foot).y)*1.13:height;
    const h=Number.isFinite(stature)&&stature>0?stature:height;
    const left=find(/^(左足|左脚|leftupleg|leftthigh|leftupperleg|thighl)$/),right=find(/^(右足|右脚|rightupleg|rightthigh|rightupperleg|thighr)$/);
    const point=left>=0&&right>=0?rest(left).lerp(rest(right),.5):rest(hip);
    point.y-=h*(left>=0&&right>=0?.027:.055);point.z+=h*.069;
    const inv=sk.boneInverses[hip];
    fitted={anchor:sk.bones[hip],localPoint:point.applyMatrix4(inv),localAxes:new Quaternion().setFromRotationMatrix(new Matrix4().extractRotation(inv)),size:h/typicalHeight};
  });
  if(fitted)return fitted;
  const mid=bounds.getCenter(new Vector3());
  // A missing pelvis still tracks the actor, its authoring origin and its yaw.
  mid.y=bounds.min.y+height*.46;
  mid.z+=Math.min((bounds.max.z-bounds.min.z)*.50,height*.11);
  return {anchor:root,localPoint:mid,localAxes:new Quaternion(),size:height/typicalHeight};
}

function socketOf(root:Object3D) {
  let socket=sockets.get(root);if(!socket){socket=fit(root);sockets.set(root,socket);}
  return socket;
}

/** The receiver only participates in its wearer's world. Its immutable shape
 * uses that skeleton's authored units, even before a transmitter is equipped. */
export function eggUnitSize(root:Object3D) {
  const {size,anchor}=socketOf(root);
  anchor.updateWorldMatrix(true,false);
  return size*anchor.matrixWorld.getMaxScaleOnAxis()/root.scale.x;
}

const origin=new Vector3();
/** World-space attachment. During a solver step the actor is temporarily at
 * unit scale: restore visual metres about its pivot BEFORE applying cm offsets. */
export function poseEggReceiver(group:Object3D,root:Object3D|null,offset:EggOffset,visualRatio=1) {
  if(!root?.visible){group.visible=false;return;}
  const {anchor,localAxes,localPoint,size}=socketOf(root);
  anchor.localToWorld(group.position.copy(localPoint));
  if(visualRatio!==1){origin.setFromMatrixPosition(root.matrixWorld);group.position.sub(origin).multiplyScalar(visualRatio).add(origin);}
  anchor.getWorldQuaternion(group.quaternion).multiply(localAxes);
  group.translateX(offset[0]*.01);group.translateY(offset[1]*.01);group.translateZ(offset[2]*.01);
  group.scale.setScalar(size*anchor.matrixWorld.getMaxScaleOnAxis()*visualRatio); group.visible=true;
}
