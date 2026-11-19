import { useEffect, useMemo } from 'react';
import { useMmdVrStore } from '../mmdVrStore';
import { makeBlower, makePunch, makeSilicone } from './workshopModels';

export function SiliconePiece(){
  const geometry=useMemo(makeSilicone,[]);useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh name="play:piece:dildo" geometry={geometry} rotation-x={-.38} position={[0,.01,-.035]}><meshStandardMaterial vertexColors roughness={.52}/></mesh>;
}
export function StampPiece(){
  const geometry=useMemo(makePunch,[]);useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh name="play:piece:post" geometry={geometry}><meshStandardMaterial vertexColors metalness={.21} roughness={.41}/></mesh>;
}
export function BubblePiece(){
  const pool=useMmdVrStore(s=>s.prefs.scenery==='pool');
  const geometry=useMemo(()=>makeBlower(pool),[pool]);useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh name="play:piece:bubbles" geometry={geometry}><meshStandardMaterial vertexColors roughness={.38}/></mesh>;
}
