import {XROrigin} from '@react-three/xr';
import {useCallback,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import type {Group} from 'three';
import {usePlayerMovement} from '../movement/usePlayerMovement';
import {MmdVrControlBar} from './MmdVrHud';
import {MmdVrControllerColliders} from './MmdVrControllerColliders';
import {MmdVrHandColliders} from './MmdVrHandColliders';
import {useMmdVrStore} from '../mmdVrStore';

import PlanetMotor from '../movement/PlanetMotor';
function FlatMotor({origin,dragging}:{origin:RefObject<Group|null>;dragging:boolean}){
  usePlayerMovement(origin,dragging);return null;
}

export function MmdVrPlayerRig({onExit,busy}:{onExit:()=>void;busy:boolean}){
  const origin=useRef<Group>(null);
  const [interactions,setInteractions]=useState(0);
  const drag=useCallback((active:boolean)=>setInteractions(n=>Math.max(0,n+(active?1:-1))),[]);
  const planet=useMmdVrStore(s=>s.prefs.scenery==='glassPlanet');
  useLayoutEffect(()=>{if(origin.current){origin.current.position.set(0,0,0);origin.current.quaternion.identity();origin.current.updateMatrixWorld(true);}},[planet]);
  return <>{planet?<PlanetMotor originRef={origin} dragging={interactions>0||busy}/>:<FlatMotor origin={origin} dragging={interactions>0||busy}/>}<XROrigin ref={origin}>
    <MmdVrControllerColliders/><MmdVrHandColliders/>
    <MmdVrControlBar onDragChange={drag} onExit={onExit} busy={busy}/>
  </XROrigin></>;
}
