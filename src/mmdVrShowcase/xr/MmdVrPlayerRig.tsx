import {XROrigin} from '@react-three/xr';
import {useCallback,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import type {Group} from 'three';
import {usePlayerMovement} from '../movement/usePlayerMovement';
import {MmdVrControlBar} from '../hud/MmdVrHud';
import {MmdVrControllerColliders} from './contact/MmdVrControllerColliders';
import {MmdVrHandColliders} from './contact/MmdVrHandColliders';
import {useMmdVrStore} from '../mmdVrStore';
import {usePoseSession} from '../pose/poseSession';

import PlanetMotor from '../movement/PlanetMotor';
function FlatMotor({origin,dragging}:{origin:RefObject<Group|null>;dragging:boolean}){
  usePlayerMovement(origin,dragging);return null;
}

export function MmdVrPlayerRig({onExit,busy,originRef}:{onExit:()=>void;busy:boolean;originRef?:RefObject<Group|null>}){
  const localOrigin=useRef<Group>(null), origin=originRef??localOrigin;
  const [interactions,setInteractions]=useState(0);
  const drag=useCallback((active:boolean)=>setInteractions(n=>Math.max(0,n+(active?1:-1))),[]);
  const planet=useMmdVrStore(s=>s.prefs.scenery==='glassPlanet');
  const dragging=usePoseSession(s=>s.dragging)||interactions>0||busy;
  useLayoutEffect(()=>{if(origin.current){origin.current.position.set(0,0,0);origin.current.quaternion.identity();origin.current.updateMatrixWorld(true);}},[origin,planet]);
  return <>{planet?<PlanetMotor originRef={origin} dragging={dragging}/>:<FlatMotor origin={origin} dragging={dragging}/>}<XROrigin ref={origin}>
    <MmdVrControllerColliders/><MmdVrHandColliders/>
    <MmdVrControlBar onDragChange={drag} onExit={onExit} busy={busy}/>
  </XROrigin></>;
}
