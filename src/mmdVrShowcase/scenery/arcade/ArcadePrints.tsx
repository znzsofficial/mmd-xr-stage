import {useEffect,useMemo} from 'react';
import {DoubleSide} from 'three';
import {useBakedSurface} from '../useBakedSurface';
import {arcadePaint} from './paintedShell';
import color from './hall-surfaces.webp';
import finish from './hall-finishes.webp';
import roughness from './hall-roughness.webp';
import lettering from './hall-lettering.webp';
import vine from './hall-ivy.webp';

const noPick=()=>null,noBody={playerCollision:false};
export function ArcadePrints({shadows}:{shadows:boolean}){
  const p=useMemo(()=>arcadePaint(shadows),[shadows]),base=useBakedSurface(color),normal=useBakedSurface(finish,'data'),rough=useBakedSurface(roughness,'data'),type=useBakedSurface(lettering),ivy=useBakedSurface(vine);
  useEffect(()=>()=>{Object.values(p).forEach(g=>g.dispose());},[p]);
  return <group name="arcade:print-finish" pointerEvents="none">
    {base&&<mesh name="arcade:enamel" geometry={p.room} userData={noBody} raycast={noPick} receiveShadow><meshStandardMaterial map={base} normalMap={normal} normalScale={[.57,.57]} roughnessMap={rough} vertexColors/></mesh>}
    {type&&<><mesh name="arcade:letterpress" geometry={p.posters} userData={noBody} raycast={noPick}><meshStandardMaterial map={type} roughness={.68}/></mesh>
      <mesh name="arcade:crt" geometry={p.screens} userData={noBody} raycast={noPick}><meshBasicMaterial map={type} toneMapped={false}/></mesh></>}
    {ivy&&<mesh name="arcade:ivy" geometry={p.leaves} userData={noBody} raycast={noPick}><meshStandardMaterial map={ivy} alphaTest={.48} alphaToCoverage side={DoubleSide} roughness={.96}/></mesh>}
  </group>;
}
