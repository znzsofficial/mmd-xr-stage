import { useLayoutEffect } from 'react';
import { useMmdVrStore } from '../mmdVrStore';
import { useStagePlay } from './stagePlay';
import { resetEncore, resetFerry, resetKite } from './storyActions';
import { EncoreStation } from './encore/EncoreStation';
import { FerryStation } from './ferry/FerryStation';
import { KiteReel, KiteStation } from './kite/KiteStation';
import { MEADOW_SEAT } from '../scenery/placementAreas';

// One lifetime for both modes. Stowing the ribbon mic leaves a finished stage
// print visible, unlike an in-flight kite or ferry; all three end at a room boundary.
export function StoryStations(){
  const room=useMmdVrStore(s=>s.prefs.scenery),screen=useMmdVrStore(s=>s.presentation==='screen');
  const showReel=useStagePlay(s=>s.held?.toy==='kite');
  useLayoutEffect(()=>{
    const reset=()=>{resetFerry();resetKite();resetEncore();useStagePlay.getState().reset();};
    const leave=useMmdVrStore.subscribe((s,p)=>{if(s.prefs.scenery!==p.prefs.scenery||s.entryEpoch!==p.entryEpoch||!s.overlayOpen&&p.overlayOpen)reset();});
    const stow=useStagePlay.subscribe((s,p)=>{const next=s.held?.toy??s.character?.toy,prev=p.held?.toy??p.character?.toy;
      if(prev==='kite'&&next!=='kite')resetKite();if(prev==='bubbles'&&next!=='bubbles')resetFerry();});
    return ()=>{leave();stow();reset();};
  },[]);
  if(room==='pool')return <FerryStation/>;
  if(room==='liveHouse')return <EncoreStation/>;
  if(room==='lawn')return <>{screen&&showReel&&<group name="story:bench-reel" position={[MEADOW_SEAT.x,.53,MEADOW_SEAT.z]} rotation-y={MEADOW_SEAT.yaw} pointerEvents="none"><KiteReel/></group>}<KiteStation/></>;
  return null;
}
