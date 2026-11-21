import { Matrix4, Quaternion, Vector3, type Object3D, type Scene } from 'three';
import type { MmdPhysicsRigidBodyShape } from '@yohawing/three-mmd-loader/physics';
import { PARK_Y } from '../mmdRuntime/colliderReentry';
import { centerZ } from './siliconeProfile';
import type { Hand, Toy } from './propCatalog';

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

export function propColliderShape(slot:number,inverseModelScale:number):MmdPhysicsRigidBodyShape {
  const {type,size:[x,y,z]}=parts[slot].shape;
  return {type,size:[x*inverseModelScale,y*inverseModelScale,z*inverseModelScale]};
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
export const isContactTool=(toy:Toy|undefined):toy is Tool=>toy==='wand'||toy==='dildo';
export function createPropColliderFeed(){
  const matrices=parts.map(()=>parked.clone());
  let prevOwner:Owner|null=null, prevRoot:Object3D|null=null, prevSource:XRInputSource|null=null, epoch=0;
  function park(){for(const m of matrices)m.copy(parked);}
  function clear(){if(prevRoot)park();prevRoot=null;prevOwner=null;prevSource=null;}
  function sample(scene:Scene,wrist:Object3D|null,held:Owner|null,character:Owner|null,frame?:XRFrame){
    const owner=held??character;
    if(!owner||!isContactTool(owner.toy)){clear();return false;}
    const root=held?heldByScene.get(scene):wrist, data=root?.userData;
    if(!root?.visible || (held&&(!frame||frame.session.visibilityState!=='visible'||data!.propFrame!==frame||!data!.propUsable||
      data!.heldToy!==held.toy||data!.propSource?.handedness!==held.hand))){clear();return false;}
    const source=held?data!.propSource:null, currentEpoch=held?data!.trackingEpoch??0:0;
    if(owner!==prevOwner||root!==prevRoot||source!==prevSource||epoch!==currentEpoch){
      park();prevOwner=owner;prevRoot=root;prevSource=source;epoch=currentEpoch;return false;
    }
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
  return {sample,clear,getMatrices:()=>matrices};
}
