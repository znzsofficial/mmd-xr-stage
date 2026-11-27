import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { DoubleSide, type Group } from 'three';
import { makeBrushHandle, makePlume, makeWandHandle, makeWandHead, wandLights } from './boutiqueModels';
import { TOYS } from './propCatalog';
import { useWandMotor, wandFrameMs, wandTurns } from './wandMotor';
import {createWandHead,mountWandHead} from './wandHead';

export function CordlessWand() {
  const handle=useMemo(makeWandHandle,[]),head=useMemo(makeWandHead,[]), pivot=useRef<Group>(null);
  const speed=useWandMotor(s=>s.speed),grip=TOYS.wand.grip;
  useFrame(({clock},_,frame)=>{
    const joint=pivot.current,motor=useWandMotor.getState();if(!joint)return;
    if(!motor.speed){if(joint.rotation.x||joint.rotation.z)joint.rotation.set(0,0,0);return;}
    const phase=(wandTurns(motor,wandFrameMs(frame,clock.oldTime))%1)*2*Math.PI,arc=motor.speed===1?.047:.095;
    joint.rotation.set(arc*.65*Math.cos(phase),0,arc*Math.sin(phase));
  },-.5); // After the held grip switches speed, before contact and Bullet sample the cap.
  useLayoutEffect(()=>{if(pivot.current)return mountWandHead(createWandHead(pivot.current,head));},[head]);
  useEffect(()=>()=>{handle.dispose();head.dispose();},[handle,head]);
  return <group name="play:piece:wand" position={grip.point} rotation-x={-grip.pitch}>
    <mesh geometry={handle}><meshStandardMaterial vertexColors roughness={.36} metalness={.12}/></mesh>
    <group ref={pivot} name="wand:flex" position-y={.078}>
      <mesh geometry={head}><meshStandardMaterial vertexColors roughness={.64}/></mesh>
    </group>
    {wandLights.map(({radius,y},i)=><mesh key={y} name={`wand:lamp:${i+1}`} visible={speed>i} position-y={y} rotation-x={Math.PI/2}>
      <torusGeometry args={[radius,.0019,8,40]}/><meshBasicMaterial color="#a5ffdd" toneMapped={false}/>
    </mesh>)}
  </group>;
}

export function FeatherBrush() {
  const handle=useMemo(makeBrushHandle,[]),plume=useMemo(makePlume,[]),grip=TOYS.feather.grip;
  useEffect(()=>()=>{handle.dispose();plume.dispose();},[handle,plume]);
  return <group name="play:piece:feather" position={grip.point} rotation-x={-grip.pitch}>
    <mesh geometry={handle}><meshStandardMaterial vertexColors roughness={.32} metalness={.22}/></mesh>
    <mesh name="feather:plume" geometry={plume}><meshStandardMaterial vertexColors roughness={.94} side={DoubleSide}/></mesh>
  </group>;
}
