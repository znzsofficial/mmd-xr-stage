import {XROrigin} from '@react-three/xr';
import {lazy,Suspense,useCallback,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import {BackSide,type Group,type Mesh} from 'three';
import {usePlayerMovement} from '../movement/usePlayerMovement';
import {MmdVrControlBar} from './MmdVrHud';
import {MmdVrControllerColliders} from './MmdVrControllerColliders';
import {MmdVrHandColliders} from './MmdVrHandColliders';
import {useMmdVrStore} from '../mmdVrStore';

const PlanetMotor=lazy(()=>import('../movement/PlanetMotor'));
function FlatMotor({origin,veil,dragging}:{origin:RefObject<Group|null>;veil:RefObject<Mesh|null>;dragging:boolean}){
  usePlayerMovement(origin,veil,dragging);return null;
}

export function MmdVrPlayerRig({onExit,busy}:{onExit:()=>void;busy:boolean}){
  const origin=useRef<Group>(null),veil=useRef<Mesh>(null);
  const [interactions,setInteractions]=useState(0);
  const drag=useCallback((active:boolean)=>setInteractions(n=>Math.max(0,n+(active?1:-1))),[]);
  const planet=useMmdVrStore(s=>s.prefs.scenery==='glassPlanet');
  useLayoutEffect(()=>{if(origin.current){origin.current.position.set(0,0,0);origin.current.quaternion.identity();origin.current.updateMatrixWorld(true)}if(veil.current)veil.current.visible=false;},[planet]);
  return <>{planet?<Suspense fallback={null}><PlanetMotor originRef={origin} veilRef={veil} dragging={interactions>0||busy}/></Suspense>:<FlatMotor origin={origin} veil={veil} dragging={interactions>0||busy}/>}<XROrigin ref={origin}>
    <mesh ref={veil} visible={false} frustumCulled={false} renderOrder={900} pointerEvents="none" raycast={()=>null}>
      <sphereGeometry args={[.22,12,8]}/><meshBasicMaterial side={BackSide} color="#20252a" fog={false} toneMapped={false} depthTest={false}/>
    </mesh>
    <MmdVrControllerColliders/><MmdVrHandColliders/>
    <MmdVrControlBar onDragChange={drag} onExit={onExit} busy={busy}/>
  </XROrigin></>;
}
