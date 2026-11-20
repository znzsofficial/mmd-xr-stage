import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { DoubleSide, type Group } from 'three';
import { makeBrushHandle, makePlume, makeWandHandle, makeWandHead, wandLights } from './boutiqueModels';
import { TOYS } from './propCatalog';
import { useWandMotor } from './wandMotor';

function MovingHead({pivot,speed}:{pivot:RefObject<Group|null>;speed:1|2}) {
  const phase=useRef(0);
  useFrame((_,dt)=>{
    const joint=pivot.current;if(!joint)return;
    phase.current=(phase.current+Math.min(dt,.05)*(speed===1?4:7)*2*Math.PI)%(Math.PI*2);
    const arc=speed===1?.047:.095;
    joint.rotation.set(arc*.65*Math.cos(phase.current),0,arc*Math.sin(phase.current));
  });
  useLayoutEffect(()=>{const joint=pivot.current;return ()=>{joint?.rotation.set(0,0,0);};},[pivot]);
  return null;
}

export function CordlessWand() {
  const handle=useMemo(makeWandHandle,[]),head=useMemo(makeWandHead,[]), pivot=useRef<Group>(null);
  const speed=useWandMotor(s=>s.speed),grip=TOYS.wand.grip;
  useEffect(()=>()=>{handle.dispose();head.dispose();},[handle,head]);
  return <group name="play:piece:wand" position={grip.point} rotation-x={-grip.pitch}>
    <mesh geometry={handle}><meshStandardMaterial vertexColors roughness={.36} metalness={.12}/></mesh>
    <group ref={pivot} name="wand:flex" position-y={.078}>
      <mesh geometry={head}><meshStandardMaterial vertexColors roughness={.64}/></mesh>
    </group>
    {wandLights.map(({radius,y},i)=><mesh key={y} name={`wand:lamp:${i+1}`} visible={speed>i} position-y={y} rotation-x={Math.PI/2}>
      <torusGeometry args={[radius,.0019,8,40]}/><meshBasicMaterial color="#a5ffdd" toneMapped={false}/>
    </mesh>)}
    {speed!==0&&<MovingHead pivot={pivot} speed={speed}/>}
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
