import type { Scene } from 'three';
import { useBackpack } from '../../backpack';
import { actorFacePalette } from '../actorResponse';
import { createVertexMorphLayer } from '../vertexMorphLayer';
import type { WandModel } from '../wandSurface';
import { useRemoteEgg } from './remoteMotor';
import { wearableIn } from './wearableCollider';

export function createEggResponse(){
  const layer=createVertexMorphLayer();
  function present(scene:Scene,getModel:(runtimeId:string)=>WandModel|null){
    const {assetId,mode}=useRemoteEgg.getState(),receiver=wearableIn(scene);
    const amount=receiver?.expression??0;
    if(!assetId||!mode||!receiver||amount<=0){layer.restore();return;}
    const live=useBackpack.getState().live[assetId],model=live?.visible?getModel(live.runtimeId):null;
    if(!model||model.root!==receiver.wearer){layer.restore();return;}
    // The gentle/resting face from the same vetted palette as contact gestures.
    // No fabricated contact, VMD track, or guess from a non-facial vertex name.
    layer.apply(actorFacePalette(model.mesh)[2]??null,model,amount);
  }
  return {present,restore:layer.restore};
}
