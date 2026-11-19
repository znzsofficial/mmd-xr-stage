import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Group } from 'three';
import { saberLit } from './saberLight';
import { makeHilt } from './workshopModels';

/** Origin matches the palm offset of the other stage toys. The glow is local
 * geometry, so it reads against dark stone without lighting the actor or HUD. */
export function AstralSaber() {
  const blade = useRef<Group>(null);
  const hilt=useMemo(makeHilt,[]);useEffect(()=>()=>hilt.dispose(),[hilt]);
  const extension = useRef(saberLit() ? 1 : 0);
  useFrame((_, delta) => {
    if (!blade.current) return;
    const goal = saberLit() ? 1 : 0;
    const step = Math.min(.05,delta)*5;
    extension.current += Math.max(-step,Math.min(step,goal-extension.current));
    blade.current.visible = extension.current > 0;
    blade.current.scale.y = Math.max(.0001,extension.current);
  });
  return <group name="play:piece:saber" position={[0,-.042,-.06]} rotation-x={-.81}>
    <mesh geometry={hilt}><meshStandardMaterial vertexColors metalness={.38} roughness={.42}/></mesh>
    <group position-y={.107} ref={blade} visible={false} name="saber:blade">
      <mesh position-y={.375}><capsuleGeometry args={[.014,.72,4,12]}/><meshBasicMaterial color="#d6fff1" toneMapped={false}/></mesh>
      <mesh position-y={.375}><capsuleGeometry args={[.023,.72,4,12]}/><meshBasicMaterial color="#3cebdc" transparent opacity={.62} depthWrite={false} blending={AdditiveBlending} toneMapped={false}/></mesh>
      <mesh position-y={.375} renderOrder={1}><capsuleGeometry args={[.034,.72,4,12]}/><meshBasicMaterial color="#40e3cf" transparent opacity={.13} depthWrite={false} blending={AdditiveBlending} toneMapped={false}/></mesh>
    </group>
  </group>;
}
