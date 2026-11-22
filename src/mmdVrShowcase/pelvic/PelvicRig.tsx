import { useThree } from '@react-three/fiber';
import { useImperativeHandle, useLayoutEffect, useRef, type Ref } from 'react';
import type { Group } from 'three';
import { LiquidSpray } from '../play/heldEffects';
import type { GripFrame } from '../play/propView';
import { SiliconePiece } from '../play/simplePieces';
import { useStagePlay } from '../play/stagePlay';
import { mountPelvicRig, type PelvicRigHandle, type PelvicRigProps } from './rig';
import { usePelvic } from './store';
export type {PelvicRigHandle} from './rig';

export function PelvicRig({getRoot,getSurface,ref}:PelvicRigProps&{ref?:Ref<PelvicRigHandle>}){
  const {scene,gl}=useThree(),host=useRef<Group>(null),piece=useRef<Group>(null),spray=useRef<((f:GripFrame)=>void)|null>(null);
  const room=useRef<ReturnType<typeof mountPelvicRig>|null>(null);
  const target=usePelvic(s=>s.active?.mode!=='xrManual'?s.active?.assetId:null),owner=useStagePlay(s=>s.stand?.assetId);
  useLayoutEffect(()=>{if(!host.current)return;
    const driver=mountPelvicRig({scene,getRoot,getSurface,host:host.current,standPiece:()=>piece.current,standSpray:()=>spray.current,
      tracked:frame=>{const space=gl.xr.getReferenceSpace();return !!space&&!!frame.getViewerPose(space);}});
    room.current=driver;return ()=>{driver.dispose();if(room.current===driver)room.current=null;};
  },[scene,gl,getRoot,getSurface]);
  useImperativeHandle(ref,()=>({advance:(dt,frame,blocked)=>room.current?.advance(dt,frame,blocked),interrupt:()=>room.current?.interrupt(),
    getAperture:()=>room.current?.getAperture()??null,getStandRoot:()=>room.current?.getStandRoot()??null,getStandBinding:()=>room.current?.getStandBinding()??null,
    getActorContact:()=>room.current?.getActorContact()??null,
    getObserverAnchor:out=>room.current?.getObserverAnchor(out)??false}),[]);
  return <group ref={host} name="pelvic:rig" pointerEvents="none">
    {owner&&target===owner&&<group key={owner}><group ref={piece} visible={false} name="pelvic:stand-piece"><SiliconePiece/></group><LiquidSpray ref={spray}/></group>}
  </group>;
}
