import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { useMmdVrStore } from '../../mmdVrStore';
import { sampleStageGravity } from '../../movement/gravityField';
import type { FrameEffectProps, GripFrame, PropView } from '../propView';
import { createLanternDisplay } from './lanternDisplay';
import { createLanternFlight, lanternOutlet } from './lanternFlight';
import { lanternHandpiece } from './lanternPaper';

function PaperLantern(){
  const paper=useMemo(lanternHandpiece,[]);useEffect(()=>()=>paper.dispose(),[paper]);
  return <mesh name="play:piece:lanternPod" geometry={paper}><meshStandardMaterial vertexColors roughness={.83}/></mesh>;
}

function LanternShow({ref}:FrameEffectProps){
  const root=useRef<Group>(null),tick=useRef<((frame:GripFrame)=>void)|null>(null);
  useLayoutEffect(()=>{
    const group=root.current!,show=createLanternDisplay(),flight=createLanternFlight(sampleStageGravity);
    group.add(show.group);
    tick.current=frame=>{flight.step(useMmdVrStore.getState().prefs.scenery,frame);show.draw(flight.pods);};
    const off=useMmdVrStore.subscribe((s,prev)=>{
      if(s.prefs.scenery!==prev.prefs.scenery||s.entryEpoch!==prev.entryEpoch){flight.clear();show.draw(flight.pods);}
    });
    return ()=>{off();tick.current=null;group.remove(show.group);show.dispose();};
  },[]);
  useImperativeHandle(ref,()=>(frame:GripFrame)=>tick.current?.(frame),[]);
  return <group ref={root} pointerEvents="none"/>;
}

export const lanternPod:PropView={Piece:PaperLantern,HeldEffect:LanternShow,outlet:lanternOutlet};
