import { useBackpack } from '../backpack/store';
import { useStagePlay } from './stagePlay';
import { clearRemoteEgg, startEggBinding, useRemoteEgg } from './remote/remoteMotor';

export { useRemoteEgg, selectEggPattern, cycleRemoteEgg, stopRemoteEgg, adjustRemoteEgg, resetEggOffset, type RemoteMode, type EggOffset } from './remote/remoteMotor';

/** Asset identity is explicit. Selecting someone else never transfers the wearable. */
export function bindRemoteEgg(assetId:string,equipOnScreen=false):boolean {
  const bag=useBackpack.getState();
  if(bag.busy||bag.draft||(bag.selected!==null&&bag.selected!==assetId)||!bag.live[assetId]?.visible||
     !bag.entries.some(e=>e.id===assetId&&e.kind==='model'))return false;
  const play=useStagePlay.getState();
  if(play.held?.toy!=='remoteEgg'){if(!equipOnScreen)return false;play.equip('remoteEgg','right');}
  startEggBinding(assetId); return true;
}

/** Actor-sheet callbacks can outlive a transfer. Never stop or nudge the new wearer. */
export function onEggWearer(assetId:string,command:()=>void){
  const bag=useBackpack.getState();
  if(useRemoteEgg.getState().assetId===assetId&&(!bag.selected||bag.selected===assetId))command();
}
export const removeRemoteEgg=(assetId:string)=>onEggWearer(assetId,clearRemoteEgg);

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
