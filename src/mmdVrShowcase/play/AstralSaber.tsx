import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Group } from 'three';
import { useStagePlay } from './stagePlay';

/** Origin matches the palm offset of the other stage toys. The glow is local
 * geometry, so it reads against dark stone without lighting the actor or HUD. */
export function AstralSaber() {
  const blade = useRef<Group>(null);
  const extension = useRef(useStagePlay.getState().saberLit ? 1 : 0);
  useFrame((_, delta) => {
    if (!blade.current) return;
    const goal = useStagePlay.getState().saberLit ? 1 : 0;
    const step = Math.min(.05,delta)*5;
    extension.current += Math.max(-step,Math.min(step,goal-extension.current));
    blade.current.visible = extension.current > 0;
    blade.current.scale.y = Math.max(.0001,extension.current);
  });
  return <group name="play:piece:saber" position={[0,-.042,-.06]} rotation-x={-.81}>
    <mesh><cylinderGeometry args={[.023,.021,.21,12]}/><meshStandardMaterial color="#263c51" roughness={.48}/></mesh>
    {[-.103,-.072,-.049,-.026,-.003,.02,.081,.096].map((y,i)=><mesh key={y} position-y={y}>
      <cylinderGeometry args={[i>5?.032:.024,i>5?.031:.025,i===0?.019:.009,12]}/><meshStandardMaterial color={i===0||i>5?'#d4aa69':'#60748a'}/></mesh>)}
    <mesh position={[0,.052,.022]} scale={[.011,.016,.007]}><octahedronGeometry/><meshBasicMaterial color="#83f2dd"/></mesh>
    <group position-y={.107} ref={blade} visible={false} name="saber:blade">
      <mesh position-y={.375}><capsuleGeometry args={[.014,.72,4,12]}/><meshBasicMaterial color="#d6fff1" toneMapped={false}/></mesh>
      <mesh position-y={.375}><capsuleGeometry args={[.023,.72,4,12]}/><meshBasicMaterial color="#3cebdc" transparent opacity={.62} depthWrite={false} blending={AdditiveBlending} toneMapped={false}/></mesh>
      <mesh position-y={.375} renderOrder={1}><capsuleGeometry args={[.034,.72,4,12]}/><meshBasicMaterial color="#40e3cf" transparent opacity={.13} depthWrite={false} blending={AdditiveBlending} toneMapped={false}/></mesh>
    </group>
  </group>;
}
