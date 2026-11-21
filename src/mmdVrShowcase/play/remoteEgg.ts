import { useBackpack } from '../backpack';
import { useStagePlay } from './stagePlay';
import { startEggBinding, useRemoteEgg } from './remote/remoteMotor';

export { useRemoteEgg, cycleRemoteEgg, adjustRemoteEgg, resetEggOffset, type RemoteMode, type EggOffset } from './remote/remoteMotor';

/** Asset identity is explicit. Selecting someone else never transfers the wearable. */
export function bindRemoteEgg(assetId:string):boolean {
  const bag=useBackpack.getState();
  if(useStagePlay.getState().held?.toy!=='remoteEgg'||bag.busy||bag.draft||(bag.selected!==null&&bag.selected!==assetId)||!bag.live[assetId]?.visible||
    !bag.entries.some(e=>e.id===assetId&&e.kind==='model'))return false;
  startEggBinding(assetId); return true;
}

// Observe the room's atomic actor publications, including a command to put away,
// file-library removal, or a same-id replacement. Do not reattach on reappearance.
useBackpack.subscribe((bag,prev)=>{
  const {assetId}=useRemoteEgg.getState(); if(!assetId)return;
  if(!bag.live[assetId]?.visible || bag.live[assetId].runtimeId!==prev.live[assetId]?.runtimeId ||
     (bag.command?.type==='remove' && bag.command.id===assetId) ||
     (bag.entries!==prev.entries && !bag.entries.some(e=>e.id===assetId&&e.kind==='model'))){
    useStagePlay.getState().stow();
  }
});
