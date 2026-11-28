import { useLayoutEffect } from 'react';
import { useMmdVrStore } from '../mmdVrStore';
import { hasToyStation, shelfToys, TOYS } from './propCatalog';
import * as views from './propViews';
import { useStagePlay } from './stagePlay';

export function StoryStations(){
  const room=useMmdVrStore(s=>s.prefs.scenery);
  useLayoutEffect(()=>{
    const reset=()=>useStagePlay.getState().reset();
    const off=useMmdVrStore.subscribe((s,p)=>{if(s.prefs.scenery!==p.prefs.scenery||s.entryEpoch!==p.entryEpoch||!s.overlayOpen&&p.overlayOpen)reset();});
    return ()=>{off();reset();};
  },[]);
  return <>{shelfToys.map(toy=>{
    const item=TOYS[toy], Station=views[item.view].Station;
    return Station&&hasToyStation(toy,room) ? <Station key={toy}/> : null;
  })}</>;
}
