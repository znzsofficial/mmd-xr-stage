import { Group, Matrix4, type Object3D, type Scene } from 'three';
import { poseEggReceiver } from './eggSocket';
import { eggPlacementEpoch, eggPowerAt, useRemoteEgg } from './remoteMotor';

// One soft capsule inside the silicone shell. Decorative loop and transmitter
// have no proxy. Metres in the receiver's local (-31…+29 mm) profile.
export const eggCapsule={type:'capsule',size:[.0175,.021,0]} as const;
const center=new Matrix4().makeTranslation(0,-.001,0);

/** Capture motor phase once per render frame; never use VMD time. The bone
 * itself is read later, inside the wearer's pre-Bullet evaluation or after
 * writeback for display. Neither path asks the evaluator for another pose. */
export function createWearableCollider(){
  const socket=new Group(), flex=new Matrix4();
  let wearer:Object3D|null=null,epoch=-1,xr=false,previousMs=0;
  const offset:[number,number,number]=[0,0,0];
  function begin(root:Object3D|null,nowMs:number,inXR:boolean){
    const {offset:target,assetId}=useRemoteEgg.getState();if(!assetId)root=null;
    const snap=wearer!==root||epoch!==eggPlacementEpoch();
    const dx=target[0]-offset[0],dy=target[1]-offset[1],dz=target[2]-offset[2];
    // 12 cm/s, including a stream of key presses or a long suspend/resume gap.
    const length=Math.hypot(dx,dy,dz),travel=.012*Math.min(50,Math.max(0,nowMs-previousMs));
    const k=snap||length<=travel?1:travel/length;
    offset[0]+=k*dx;offset[1]+=k*dy;offset[2]+=k*dz;previousMs=nowMs;
    wearer=root;epoch=eggPlacementEpoch();xr=inXR;
    const power=eggPowerAt(nowMs), phase=nowMs*.047;
    flex.makeRotationZ(.042*power*Math.sin(phase)).setPosition(.0016*power*Math.cos(phase),0,0);
  }
  function pose(group:Object3D,physics:boolean){
    if(!wearer?.visible||epoch!==eggPlacementEpoch()){group.visible=false;return false;}
    const visual=wearer.userData.mmdVisualScale;
    const ratio=physics&&typeof visual==='number'&&visual>0?visual/wearer.scale.x:1;
    poseEggReceiver(group,wearer,offset,ratio);
    group.updateMatrix();group.matrix.multiply(flex);
    return true;
  }
  return {begin,get wearer(){return wearer;},get epoch(){return epoch;},get xr(){return xr;},
    present(group:Object3D){group.matrixAutoUpdate=false;if(pose(group,false))group.matrixWorldNeedsUpdate=true;},
    write(out:Matrix4){if(!pose(socket,true))return false;out.multiplyMatrices(socket.matrix,center);return true;}};
}
export type WearableCollider=ReturnType<typeof createWearableCollider>;
const mounted=new WeakMap<Scene,{source:WearableCollider;view:Object3D}>();
export const wearableIn=(scene:Scene)=>mounted.get(scene)?.source;
/** Called after the room's pose evaluation, even with Bullet switched off. */
export function presentRemoteWearable(scene:Scene){const m=mounted.get(scene);if(m)m.source.present(m.view);}
export function mountWearableCollider(scene:Scene,source:WearableCollider,view:Object3D){
  const entry={source,view};mounted.set(scene,entry);
  return ()=>{if(mounted.get(scene)===entry)mounted.delete(scene);};
}
