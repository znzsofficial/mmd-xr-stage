import { useFrame } from '@react-three/fiber';
import { useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { Color, type Group, type MeshBasicMaterial } from 'three';
import { useMmdVrStore } from '../../mmdVrStore';
import { TOYS } from '../propCatalog';
import type { FrameEffectProps } from '../propView';
import { createEggFeedback } from './eggFeedback';
import { eggPowerAt, useRemoteEgg } from './remoteMotor';
import { makeEggHandset, makeEggReceiver } from './remoteModels';

const tints=['#705c67','#8ff5d8','#ffc26e','#ceaaff'].map(c=>new Color(c));

// One illuminated bar per mode on the handset; a matching flexible status seam
// on the receiver. Number and cadence both work without discriminating colours.
function LitIndicator({receiver=false}:{receiver?:boolean}) {
  const mode=useRemoteEgg(s=>s.mode), mat=useRef<MeshBasicMaterial>(null);
  useFrame(()=>{if(mat.current)mat.current.color.copy(tints[mode]).multiplyScalar(.26+1.04*eggPowerAt(performance.now()));});
  return <group name="egg:indicator">
    {receiver?<mesh rotation-x={Math.PI/2} position-y={-.019} scale={[1,.88,1]}><torusGeometry args={[.0181,.0014,6,32]}/>
      <meshBasicMaterial ref={mat} toneMapped={false}/></mesh>:
    <instancedMesh args={[undefined,undefined,3]} count={mode} onUpdate={mesh=>{
      // Local matrix storage is owned by this tiny window only.
      for(let i=0;i<3;i++){mesh.matrix.makeTranslation((i-1)*.009,.041,.009);mesh.setMatrixAt(i,mesh.matrix);}
      mesh.matrix.identity();mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
    }}><boxGeometry args={[.005,.008,.001]}/><meshBasicMaterial ref={mat} toneMapped={false}/></instancedMesh>}
  </group>;
}

export function EggHandset() {
  const shell=useMemo(makeEggHandset,[]),on=useRemoteEgg(s=>s.mode!==0);
  useEffect(()=>()=>shell.dispose(),[shell]);
  const {point,pitch}=TOYS.remoteEgg.grip;
  return <group name="play:piece:remoteEgg" position={point} rotation-x={-pitch}>
    <mesh geometry={shell}><meshStandardMaterial vertexColors roughness={.42}/></mesh>
    {on&&<LitIndicator/>}
  </group>;
}

export function EggReceiver() {
  const shell=useMemo(makeEggReceiver,[]), joint=useRef<Group>(null), on=useRemoteEgg(s=>s.mode!==0);
  useEffect(()=>()=>shell.dispose(),[shell]);
  useFrame(()=>{if(!joint.current)return;
    const now=performance.now(),power=eggPowerAt(now);
    joint.current.rotation.z=.042*power*Math.sin(now*.047);
    joint.current.position.x=.0016*power*Math.cos(now*.047);
  });
  return <group ref={joint} name="egg:silicone">
    <mesh geometry={shell}><meshStandardMaterial vertexColors roughness={.72}/></mesh>
    {on&&<LitIndicator receiver/>}
  </group>;
}

export function EggHandFeedback({ref}:FrameEffectProps) {
  const driver=useMemo(createEggFeedback,[]);
  useEffect(()=>()=>driver.reset(),[driver]);
  useImperativeHandle(ref,()=>frame=>driver.update(frame,useMmdVrStore.getState().prefs.physicsHapticLevel,performance.now()),[driver]);
  return null;
}
