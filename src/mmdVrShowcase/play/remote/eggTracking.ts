import type { Scene } from 'three';
import { hasEggTransmitterPose } from '../propColliders';
import { useStagePlay } from '../stagePlay';
import { stopRemoteEgg } from './remoteMotor';

export function checkEggTracking(scene:Scene,frame:XRFrame|undefined){
  if(!hasEggTransmitterPose(scene,useStagePlay.getState().held,frame))stopRemoteEgg();
}

/** Visibility and controller removal can suspend frames. Cut the motor here
 * as well as on a missing grip/ray pose; reacquisition is never a Start. */
export function watchEggSession(session:XRSession,isRoomStale:()=>boolean){
  const stop=()=>{if(!isRoomStale())stopRemoteEgg();};
  const visibility=()=>{if(session.visibilityState!=='visible')stop();};
  const devices=(event:XRInputSourcesChangeEvent)=>{
    const held=useStagePlay.getState().held;
    if(held?.toy==='remoteEgg'&&Array.from(event.removed??[]).some(s=>s.handedness===held.hand&&!s.hand&&s.gripSpace))stop();
  };
  visibility();
  session.addEventListener('visibilitychange',visibility);
  session.addEventListener('inputsourceschange',devices);
  session.addEventListener('end',stop);
  return ()=>{session.removeEventListener('visibilitychange',visibility);session.removeEventListener('inputsourceschange',devices);session.removeEventListener('end',stop);};
}
