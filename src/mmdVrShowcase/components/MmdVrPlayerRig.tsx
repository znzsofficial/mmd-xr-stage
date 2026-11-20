import {XROrigin} from '@react-three/xr';
import {useCallback,useRef,useState} from 'react';
import {BackSide,type Group,type Mesh} from 'three';
import {usePlayerMovement} from '../movement/usePlayerMovement';
import {MmdVrControlBar} from './MmdVrHud';
import {MmdVrControllerColliders} from './MmdVrControllerColliders';
import {MmdVrHandColliders} from './MmdVrHandColliders';

export function MmdVrPlayerRig({onExit,busy}:{onExit:()=>void;busy:boolean}){
  const origin=useRef<Group>(null),veil=useRef<Mesh>(null);
  const [interactions,setInteractions]=useState(0);
  const drag=useCallback((active:boolean)=>setInteractions(n=>Math.max(0,n+(active?1:-1))),[]);
  usePlayerMovement(origin,veil,interactions>0||busy);
  return <XROrigin ref={origin}>
    <mesh ref={veil} visible={false} frustumCulled={false} renderOrder={900} pointerEvents="none" raycast={()=>null}>
      <sphereGeometry args={[.22,12,8]}/><meshBasicMaterial side={BackSide} color="#20252a" fog={false} toneMapped={false} depthTest={false}/>
    </mesh>
    <MmdVrControllerColliders/><MmdVrHandColliders/>
    <MmdVrControlBar onDragChange={drag} onExit={onExit} busy={busy}/>
  </XROrigin>;
}
