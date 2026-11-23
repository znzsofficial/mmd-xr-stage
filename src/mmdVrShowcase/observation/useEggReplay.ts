import {useLayoutEffect,useState} from 'react';
import {useStore} from 'zustand';
import {useLanguageStore} from '../../languageStore';
import {useBackpack} from '../backpack';
import {createEggReplay} from '../bodyState/reproduction/eggReplay';
import {eggsFor,useConception,type ConceptionEvent} from '../bodyState/reproduction/store';
import {useMmdVrStore} from '../mmdVrStore';
import {readAtlasView,useAtlasSettings} from '../pelvic/atlas/view';

export function useEggReplay(assetId:string,runtimeId:string,record:ConceptionEvent|undefined){
  const [player]=useState(createEggReplay),take=useStore(player.state),playing=!!record&&take.event===record;
  const zh=useLanguageStore(s=>s.language==='zh');
  const epoch=useMmdVrStore(s=>s.entryEpoch),room=useMmdVrStore(s=>s.prefs.scenery);
  const owner=useBackpack(s=>s.selected===assetId&&s.live[assetId]?.runtimeId===runtimeId&&s.live[assetId].visible);
  function current(){
    const stage=useMmdVrStore.getState(),bag=useBackpack.getState(),live=bag.live[assetId];
    return !!record&&stage.entryEpoch===epoch&&stage.prefs.scenery===room&&stage.overlayOpen&&
      bag.selected===assetId&&live?.runtimeId===runtimeId&&live.visible&&
      eggsFor(assetId).find(e=>e.id===readAtlasView(assetId).eggId)?.event===record;
  }
  useLayoutEffect(()=>{
    if(!record)return;
    const check=()=>{if(player.state.getState().event&&!current())player.stop();};
    // Losing this selection or room cancels even a batched away-and-back.
    const off=[useMmdVrStore.subscribe((s,p)=>{
      if(s.entryEpoch!==epoch||s.prefs.scenery!==room||!s.overlayOpen||s.presentation!==p.presentation)player.stop();
    }),useBackpack.subscribe(check),useConception.subscribe(check),useAtlasSettings.subscribe(check)];
    check();return ()=>{off.forEach(f=>f());player.stop();};
  },[player,assetId,runtimeId,record,epoch,room]);
  return {player,playing,paused:playing&&take.paused,disabled:!record||!owner,token:record?record.id*2+Number(playing):0,
    label:playing?(zh?'停止回看':'Stop result replay'):(zh?'回看最近结果':'Replay latest result'),
    press:()=>{if(playing)player.stop();else if(record&&current())player.start(record);}};
}
