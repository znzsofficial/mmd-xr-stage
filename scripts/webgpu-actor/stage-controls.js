import {useBackpack} from '../../src/mmdVrShowcase/backpack/store';
import {getMmdVrClock} from '../../src/mmdVrShowcase/stage/mmdVrClock';
import {useMmdVrStore} from '../../src/mmdVrShowcase/mmdVrStore';

// The controlled room has one marked standing position and one actor. These
// controls are only producers of ordinary backpack/transport commands.
export function stageControls(selection) {
  const held = new Map();
  function operate(key) {
    const stage=useMmdVrStore.getState(),bag=useBackpack.getState();
    if (!stage.captureStage || stage.assetLoad.running || stage.physicsBusy || stage.physicsFatal || bag.busy) return;
    if(key==='physics'){stage.setPhysicsEnabled(!stage.physicsEnabled);return;}
    const live=Object.keys(bag.live)[0],id=live??selection.model;
    if(!id)return;
    if(key==='left'){
      if(live)bag.putAway(live);
      else {bag.beginPlace(id);bag.confirmPlace(id,0,-1.85,0);}
    }else if(key==='right' && live){
      const file=bag.entries.find(e=>e.id===selection.motion && e.kind==='motion')?.file;
      if(file && bag.bindings[id]?.body!==file)bag.applyMotion(id,file,'body');
      else if(stage.duration>0){
        if(!stage.playing && getMmdVrClock().time>=stage.duration)stage.requestSeek(0);
        stage.setPlaying(!stage.playing);
      }
    }
  }
  return {operate,reset:()=>held.clear(),sample(sources){
    for(const old of held.keys())if(!Array.prototype.includes.call(sources,old))held.delete(old);
    for(const source of sources){
      if(!source.gamepad||source.hand)continue;
      const down=Number(!!source.gamepad.buttons[4]?.pressed) | (Number(source.handedness==='left' && !!source.gamepad.buttons[5]?.pressed)<<1);
      const prev=held.get(source);
      if(prev!==undefined){
        if((down&1)&&!(prev&1))operate(source.handedness);
        else if((down&2)&&!(prev&2))operate('physics');
      }
      held.set(source,down);
    }
  }};
}
