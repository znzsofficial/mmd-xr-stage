import {useBackpack} from '../backpack';
import {useHudWorldInput} from '../components/hudWorldInput';
import {useMmdVrStore} from '../mmdVrStore';
import {useStagePlay} from '../play/stagePlay';
import {assignPelvic,enablePelvic,usePelvic} from './store';

/** The first click both opts in and asks for a stationary stand. The room can
 * only report its fitted opening on a subsequent frame. The sheet owns this
 * one-shot request; cancelling never undoes the player's opt-in. */
export function prepareFirstStand(assetId:string,runtimeId:string,source:'screen'|'xr'){
  const stage=useMmdVrStore.getState(),play=useStagePlay.getState();
  const valid=()=>{
    const s=useMmdVrStore.getState(),b=useBackpack.getState(),p=useStagePlay.getState();
    return (typeof document==='undefined'||!document.hidden)&&s.overlayOpen&&s.presentation===source&&s.entryEpoch===stage.entryEpoch&&s.prefs.scenery===stage.prefs.scenery&&
      !s.assetLoad.running&&!s.physicsBusy&&!s.physicsFatal&&b.selected===assetId&&b.live[assetId]?.visible&&
      b.live[assetId].runtimeId===runtimeId&&!b.busy&&!b.draft&&p.stand===play.stand&&p.held===play.held&&p.character===play.character&&
      (source!=='xr'||!useHudWorldInput.getState().blocked);
  };
  const off:(()=>void)[]=[];
  const cancel=()=>{while(off.length)off.pop()!();};
  if(!valid()||!enablePelvic(assetId,true))return cancel;
  const profile=usePelvic.getState().byAsset[assetId],active=usePelvic.getState().active;
  function check(){
    const s=usePelvic.getState();
    if(!valid()||s.byAsset[assetId]!==profile||s.active!==active){cancel();return;}
    const support=s.support[assetId];if(!support||support.runtimeId!==runtimeId)return;
    cancel();if(support.kind!=='missing')assignPelvic(assetId,'standManual',source);
  }
  off.push(useBackpack.subscribe(check),useStagePlay.subscribe(check),useMmdVrStore.subscribe(check),
    useHudWorldInput.subscribe(check),usePelvic.subscribe(check));
  if(typeof document!=='undefined'){document.addEventListener('visibilitychange',check);off.push(()=>document.removeEventListener('visibilitychange',check));}
  check();return cancel;
}
