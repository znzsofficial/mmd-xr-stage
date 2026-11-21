import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Object3D } from 'three';
import { useBackpack } from '../../backpack';
import { useMmdVrStore } from '../../mmdVrStore';
import { useRemoteEgg } from '../remoteEgg';
import { EggReceiver } from './RemotePieces';
import { poseEggReceiver } from './eggSocket';

type Props={getRoot:(runtimeId:string)=>Object3D|null};
function BoundReceiver({getRoot}:Props) {
  const node=useRef<Group>(null);
  // This subscription is mounted on binding, after the room's pose evaluator.
  useFrame(()=>{
    if(!node.current)return;
    const {assetId,offset}=useRemoteEgg.getState(), actor=assetId&&useBackpack.getState().live[assetId];
    const stage=useMmdVrStore.getState();
    poseEggReceiver(node.current,actor&&actor.visible&&!stage.physicsBusy&&!stage.physicsFatal?getRoot(actor.runtimeId):null,offset);
  });
  return <group ref={node} visible={false} name="play:remote-wearable" pointerEvents="none"><EggReceiver/></group>;
}
export function RemoteWearable(props:Props) {
  return useRemoteEgg(s=>s.assetId!==null)?<BoundReceiver {...props}/>:null;
}
