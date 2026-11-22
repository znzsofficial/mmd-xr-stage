import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Group, Object3D } from 'three';
import { useBackpack } from '../../backpack';
import { useMmdVrStore } from '../../mmdVrStore';
import { useRemoteEgg } from '../remoteEgg';
import { EggReceiver } from './RemotePieces';
import { createWearableCollider, mountWearableCollider } from './wearableCollider';

type Props={getRoot:(runtimeId:string)=>Object3D|null};
function BoundReceiver({getRoot}:Props) {
  const node=useRef<Group>(null);
  const scene=useThree(s=>s.scene), source=useMemo(createWearableCollider,[scene]);
  useLayoutEffect(()=>{if(node.current)return mountWearableCollider(scene,source,node.current);},[scene,source]);
  useFrame(({clock})=>{
    const {assetId}=useRemoteEgg.getState(), actor=assetId&&useBackpack.getState().live[assetId];
    const stage=useMmdVrStore.getState();
    source.begin(actor&&actor.visible&&!stage.physicsBusy&&!stage.physicsFatal?getRoot(actor.runtimeId):null,clock.oldTime,stage.presentation==='xr');
  },-.5);
  return <group ref={node} visible={false} name="play:remote-wearable" pointerEvents="none"><EggReceiver/></group>;
}
export function RemoteWearable(props:Props) {
  return useRemoteEgg(s=>s.assetId!==null)?<BoundReceiver {...props}/>:null;
}
