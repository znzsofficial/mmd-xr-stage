import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import { useBackpack } from '../../backpack/store';
import { useMmdVrStore } from '../../mmdVrStore';
import { useRemoteEgg } from '../remoteEgg';
import { checkEggTracking,watchEggSession } from './eggTracking';
import { EggReceiver } from './RemotePieces';
import { createWearableCollider, mountWearableCollider } from './wearableCollider';
import type {WandModel} from '../wandSurface';
import type {EggSurfaceBackend} from './eggSurface';

type Props={getSurface:(runtimeId:string)=>WandModel|null;getEggSurface?:(runtimeId:string)=>EggSurfaceBackend|undefined;isRoomStale:()=>boolean};
function BoundReceiver({getSurface,getEggSurface,isRoomStale}:Props) {
  const node=useRef<Group>(null);
  const scene=useThree(s=>s.scene), gl=useThree(s=>s.gl),source=useMemo(createWearableCollider,[scene]);
  useLayoutEffect(()=>{if(node.current)return mountWearableCollider(scene,source,node.current);},[scene,source]);
  useLayoutEffect(()=>{const session=gl.xr.getSession();if(session)return watchEggSession(session,isRoomStale);},[gl,isRoomStale]);
  useFrame((_state,_dt,frame)=>{
    if(isRoomStale())return;
    const {assetId}=useRemoteEgg.getState(), actor=assetId&&useBackpack.getState().live[assetId];
    const stage=useMmdVrStore.getState();
    const inXR=stage.presentation==='xr';
    if(inXR)checkEggTracking(scene,frame);
    const model=actor&&actor.visible&&!stage.physicsBusy&&!stage.physicsFatal?getSurface(actor.runtimeId):null;
    source.begin(model?.root??null,performance.now(),inXR,model,model&&actor?getEggSurface?.(actor.runtimeId):undefined);
  },-.5);
  return <group ref={node} visible={false} name="play:remote-wearable" pointerEvents="none"><EggReceiver/></group>;
}
export function RemoteWearable(props:Props) {
  return useRemoteEgg(s=>s.assetId!==null)?<BoundReceiver {...props}/>:null;
}
