import { Vector3, type Object3D, type Scene } from 'three';
import type { GripFrame } from '../play/propView';
import type { Hand } from '../play/propCatalog';
import { siliconeOutlet } from '../play/siliconeProfile';
import {isWebgpuStageSession} from '../backpack/sessionAssets';

type Spray = (f:GripFrame)=>void;
type Queued = {token:number; root:Object3D; frame:XRFrame; f:GripFrame; source:XRInputSource; epoch:number; spray:Spray|null};
const feeds = new WeakMap<Scene, ReturnType<typeof createPelvicInput>>();
const idleSpray:GripFrame={at:new Vector3(),dir:new Vector3(),dt:0,usable:false,action:'off'};

/** Only InHand produces this event. Do not search the scene by mesh name:
 * a prop from the retiring hand/room can still be attached in this commit. */
export function queuePelvicGrip(scene:Scene,root:Object3D,frame:XRFrame|undefined,f:GripFrame,spray:Spray|null){
  if(feeds.get(scene)?.enqueue(root,frame,f,spray))return true;
  // An unassigned shelf piece in the WebGPU room has no calibrated recipient
  // or verified exterior. Never fall through to an unconditional grip plume.
  if(isWebgpuStageSession()){idleSpray.dt=f.dt;spray?.(idleSpray);return true;}
  return false;
}

export function isMountedVisible(root:Object3D,scene:Scene){
  for(let o:Object3D|null=root;o;o=o.parent){if(!o.visible)return false;if(o===scene)return true;}
  return false;
}

export function createPelvicInput(scene:Scene, owner:()=>{token:number;hand:Hand}|null){
  let queued:Queued|null=null,lastRoot:Object3D|null=null,lastToken=-1,cancelNext=false;
  const off:GripFrame={at:new Vector3(),dir:new Vector3(),usable:false,action:'off',dt:0};
  const clear=()=>{queued=null;cancelNext=!!lastRoot;};
  function enqueue(root:Object3D,frame:XRFrame|undefined,f:GripFrame,spray:Spray|null){
    const active=owner();
    // A skipped room frame, token handoff, or interrupted session must also
    // cancel the *unsent* remainder of a prior pulse. Invoke only the live
    // producer's callback, never retain an effect belonging to an old mesh.
    if(lastRoot===root&&(queued||cancelNext||lastToken!==active?.token)){off.dt=0;spray?.(off);}
    queued=null;cancelNext=false;lastRoot=active?root:null;lastToken=active?.token??-1;if(!active)return false;
    const d=root.userData,source:XRInputSource|null=d.propSource;
    if(frame?.session.visibilityState==='visible' && d.propFrame===frame && f.usable && d.propUsable &&
      source?.handedness===active.hand && !source.hand && source.gripSpace && d.heldToy==='dildo' && isMountedVisible(root,scene)){
      queued={root,frame,f,spray,token:active.token,source,epoch:d.trackingEpoch??0};
    }else{off.dt=f.dt;spray?.(off);} // Cancel an open metering pulse on tracking loss.
    return true;
  }
  function take(frame:XRFrame|undefined,token:number){
    const q=queued;queued=null;
    if(!q||q.frame!==frame||q.token!==token||q.root.userData.propFrame!==frame||frame.session.visibilityState!=='visible'||
      !q.root.userData.propUsable||q.root.userData.propSource!==q.source||(q.root.userData.trackingEpoch??0)!==q.epoch||!isMountedVisible(q.root,scene)){
      if(q)cancelNext=true;return null;}
    return q;
  }
  const feed={enqueue,take,clear};return feed;
}

export function mountPelvicInput(scene:Scene,feed:ReturnType<typeof createPelvicInput>){
  feeds.set(scene,feed);return ()=>{feed.clear();if(feeds.get(scene)===feed)feeds.delete(scene);};
}

/** The aperture is a manufactured point of the actual PlayPiece, never the
 * user's target ray, the requested rail travel, or the centre of the adapter. */
export function samplePelvicNozzle(piece:Object3D,f:GripFrame){
  piece.updateWorldMatrix(true,false);
  f.at.fromArray(siliconeOutlet.position).applyMatrix4(piece.matrixWorld);
  f.dir.fromArray(siliconeOutlet.direction).transformDirection(piece.matrixWorld);
}
