import { Matrix4, Quaternion, Vector3, type Object3D, type Scene } from 'three';
import type { MmdPhysicsRigidBodyShape } from '@yohawing/three-mmd-loader/physics';
import { PARK_Y } from '../mmdRuntime/colliderReentry';
import { centerZ } from './siliconeProfile';
import type { Hand, Toy } from './propCatalog';
import { eggUnitSize } from './remote/eggSocket';
import { eggCapsule, wearableIn, type WearableCollider } from './remote/wearableCollider';

type Tool = 'wand'|'dildo';
type Part = {tool:Tool; node:string; local:Matrix4; shape:MmdPhysicsRigidBodyShape};
const up=new Vector3(0,1,0), one=new Vector3(1,1,1), parked=new Matrix4().makeTranslation(0,PARK_Y,0);
const at=(y:number,z=0)=>new Matrix4().makeTranslation(0,y,z);
function capsule(tool:Tool,node:string,r:number,y0:number,y1:number,z0=0,z1=0):Part {
  const axis=new Vector3(0,y1-y0,z1-z0),length=axis.length();
  return {tool,node,local:new Matrix4().compose(new Vector3(0,(y0+y1)/2,(z0+z1)/2),new Quaternion().setFromUnitVectors(up,axis.normalize()),one),
    shape:{type:'capsule',size:[r,length,0]}};
}
// Metres in the rendered part's coordinates; capsule endpoints are sphere centres.
// The moving cap uses its actual flex pivot, independent of the motor setting.
const shaft='play:piece:dildo', handle='play:piece:wand';
const parts:readonly Part[]=[
  {tool:'dildo',node:shaft,local:at(-.041),shape:{type:'box',size:[.023,.004,.023]}},
  capsule('dildo',shaft,.016,-.025,.024,0,centerZ(.024)),
  capsule('dildo',shaft,.017,.024,.077,centerZ(.024),centerZ(.077)),
  capsule('dildo',shaft,.018,.085,.100,centerZ(.085),centerZ(.100)),
  capsule('wand',handle,.015,-.05,.044),
  capsule('wand',handle,.011,.053,.089),
  {tool:'wand',node:'wand:flex',local:at(.0468),shape:{type:'capsule',size:[.0255,.0028,0]}},
];

export const EGG_SLOT=parts.length;
export function propColliderShape(slot:number,inverseModelScale:number,wearer?:Object3D|null):MmdPhysicsRigidBodyShape {
  const egg=slot===EGG_SLOT, {type,size:[x,y,z]}=egg?eggCapsule:parts[slot].shape;
  const k=egg&&wearer?eggUnitSize(wearer):inverseModelScale;
  return {type,size:[x*k,y*k,z*k]};
}

const heldByScene=new WeakMap<Scene,Object3D>();
/** No traversal of the stage or retention of an XRFrame beyond its producing holder. */
export function mountHeldColliderSource(scene:Scene,root:Object3D,session:XRSession|null){
  heldByScene.set(scene,root);
  const invalidate=()=>{root.userData.propFrame=null;root.userData.trackingEpoch=(root.userData.trackingEpoch??0)+1;};
  session?.addEventListener('visibilitychange',invalidate);
  session?.addEventListener('inputsourceschange',invalidate);
  session?.addEventListener('end',invalidate);
  return ()=>{invalidate();session?.removeEventListener('visibilitychange',invalidate);session?.removeEventListener('inputsourceschange',invalidate);
    session?.removeEventListener('end',invalidate);if(heldByScene.get(scene)===root)heldByScene.delete(scene);};
}

type Owner={toy:Toy;hand:Hand};
export type StandCollider={pieceWorld:Matrix4;binding:object};
export const isContactTool=(toy:Toy|undefined):toy is Tool=>toy==='wand'||toy==='dildo';

function trackedRoot(scene:Scene,owner:Owner,frame:XRFrame|undefined,requireUsable=true){
  const root=heldByScene.get(scene),d=root?.userData;
  return root?.visible&&frame?.session.visibilityState==='visible'&&d?.propFrame===frame&&(!requireUsable||d.propUsable)&&
    d.heldToy===owner.toy&&d.propSource?.handedness===owner.hand?root:null;
}

// A menu owns the trigger, not tracking. The motor and the clothing proxy
// both require a real, current transmitter pose in XR, even with Bullet off.
export const hasEggTransmitterPose=(scene:Scene,held:Owner|null,frame:XRFrame|undefined)=>
  held?.toy==='remoteEgg'&&!!trackedRoot(scene,held,frame,false);

export function createPropColliderFeed(){
  const matrices=Array.from({length:EGG_SLOT+1},()=>parked.clone()), hidden=matrices.map(()=>parked);
  let prevOwner:object|null=null,prevRoot:Object3D|null=null,prevTracked:Object3D|null=null,prevSource:XRInputSource|null=null,epoch=0;
  let egg:WearableCollider|undefined, placement=-1, revision=0,tick=0;
  const delivered=new WeakMap<Object3D,{revision:number;parkTick:number}>();
  function clear(){if(prevOwner){for(const m of matrices)m.copy(parked);revision++;}
    prevRoot=null;prevOwner=null;prevTracked=null;prevSource=null;egg=undefined;}
  function select(owner:object,root:Object3D|null,tracked:Object3D|null,receiver?:WearableCollider){
    const source=tracked?.userData.propSource??null, boundary=tracked?.userData.trackingEpoch??0, at=receiver?.epoch??-1;
    if(owner===prevOwner&&root===prevRoot&&tracked===prevTracked&&source===prevSource&&boundary===epoch&&receiver===egg&&at===placement)return true;
    clear();revision++;prevOwner=owner;prevRoot=root;prevTracked=tracked;prevSource=source;epoch=boundary;egg=receiver;placement=at;return false;
  }
  function sample(scene:Scene,wrist:Object3D|null,held:Owner|null,character:Owner|null,frame?:XRFrame,stand?:StandCollider|null){
    tick++;
    if(stand&&!held&&!character){
      if(!select(stand.binding,null,null))return false;
      for(let i=0;i<4;i++)matrices[i].multiplyMatrices(stand.pieceWorld,parts[i].local);
      return true;
    }
    const owner=held??character;
    if(held?.toy==='remoteEgg'){
      // A panel may own the trigger while the user nudges the receiver. The
      // shell remains worn; a missing actual grip/ray must still park it.
      const receiver=wearableIn(scene),hand=frame?trackedRoot(scene,held,frame,false):null;
      if(!receiver?.wearer?.visible||((receiver.xr||frame)&&!hand)){clear();return false;}
      return select(held,receiver.wearer,hand,receiver);
    }
    if(!owner||!isContactTool(owner.toy)){clear();return false;}
    const root=held?trackedRoot(scene,held,frame):wrist;
    if(!root?.visible){clear();return false;}
    if(!select(owner,root,held?root:null))return false;
    let active=false;
    for(let i=0;i<parts.length;i++){
      const part=parts[i];if(part.tool!==owner.toy)continue;
      const node=root.getObjectByName(part.node);
      let p:Object3D|null|undefined=node;
      while(p&&p!==scene&&p.visible)p=p.parent;
      if(!node||p!==scene){matrices[i].copy(parked);continue;}
      node.updateWorldMatrix(true,false);
      matrices[i].multiplyMatrices(node.matrixWorld,part.local);active=true;
    }
    return active;
  }
  function getMatrices(steppingRoot?:Object3D|null){
    if(!steppingRoot||!prevOwner)return matrices;
    // A sleeping model can miss an entire store transition. Deliver at least
    // one parked physics frame to EACH world, including repeated buffer queries.
    let seen=delivered.get(steppingRoot);
    if(!seen){seen={revision:-1,parkTick:-1};delivered.set(steppingRoot,seen);}
    if(seen.revision!==revision){seen.revision=revision;seen.parkTick=tick;}
    if(seen.parkTick===tick)return hidden;
    if(egg&&(steppingRoot!==egg.wearer||!egg.write(matrices[EGG_SLOT])))return hidden;
    return matrices;
  }
  return {sample,clear,getMatrices};
}
