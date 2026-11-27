import type { Scene } from 'three';
import { useBackpack } from '../../backpack/store';
import { actorFacePalette } from '../actorResponse';
import { createVertexMorphLayer } from '../vertexMorphLayer';
import type { WandModel } from '../wandSurface';
import { useRemoteEgg } from './remoteMotor';
import { wearableIn } from './wearableCollider';

export function createEggResponse(){
  const layer=createVertexMorphLayer();
  let painted=false,changed=false;
  function restore(){if(painted){changed=true;painted=false;}layer.restore();}
  function present(scene:Scene,getModel:(runtimeId:string)=>WandModel|null){
    const {assetId,mode}=useRemoteEgg.getState(),receiver=wearableIn(scene);
    const amount=receiver?.expression??0;
    if(!assetId||!mode||!receiver||amount<=0){restore();return;}
    const live=useBackpack.getState().live[assetId],model=live?.visible?getModel(live.runtimeId):null;
    if(!model||model.root!==receiver.wearer){restore();return;}
    // The gentle/resting face from the same vetted palette as contact gestures.
    // No fabricated contact, VMD track, or guess from a non-facial vertex name.
    const name=actorFacePalette(model.mesh)[2];if(name){layer.apply(name,model,amount);painted=changed=true;}
  }
  return {present,restore,consumeChange(){const value=changed;changed=false;return value;}};
}
