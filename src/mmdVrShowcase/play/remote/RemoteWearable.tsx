import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Group, Object3D } from 'three';
import { useBackpack } from '../../backpack/store';
import { useMmdVrStore } from '../../mmdVrStore';
import { useRemoteEgg } from '../remoteEgg';
import { checkEggTracking,watchEggSession } from './eggTracking';
import { EggReceiver } from './RemotePieces';
import { createWearableCollider, mountWearableCollider } from './wearableCollider';

type Props={getRoot:(runtimeId:string)=>Object3D|null;isRoomStale:()=>boolean};
function BoundReceiver({getRoot,isRoomStale}:Props) {
  const node=useRef<Group>(null);
  const scene=useThree(s=>s.scene), gl=useThree(s=>s.gl),source=useMemo(createWearableCollider,[scene]);
  useLayoutEffect(()=>{if(node.current)return mountWearableCollider(scene,source,node.current);},[scene,source]);
  useLayoutEffect(()=>{const session=gl.xr.getSession();if(session)return watchEggSession(session,isRoomStale);},[gl,isRoomStale]);
  useFrame(({clock},_dt,frame)=>{
    if(isRoomStale())return;
    const {assetId}=useRemoteEgg.getState(), actor=assetId&&useBackpack.getState().live[assetId];
    const stage=useMmdVrStore.getState();
    const inXR=stage.presentation==='xr';
    if(inXR)checkEggTracking(scene,frame);
    source.begin(actor&&actor.visible&&!stage.physicsBusy&&!stage.physicsFatal?getRoot(actor.runtimeId):null,clock.oldTime,inXR);
  },-.5);
  return <group ref={node} visible={false} name="play:remote-wearable" pointerEvents="none"><EggReceiver/></group>;
}
export function RemoteWearable(props:Props) {
  return useRemoteEgg(s=>s.assetId!==null)?<BoundReceiver {...props}/>:null;
}
