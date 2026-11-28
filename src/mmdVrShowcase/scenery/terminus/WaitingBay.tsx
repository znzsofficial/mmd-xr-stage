import {useEffect,useMemo} from 'react';
import {noPick} from '../sceneryPaint';
import {useBakedSurface} from '../useBakedSurface';
import {waitingBayContact,waitingBayGeometry} from './waitingBayGeometry';
import {useCoastalPrint} from './coastalPrints';
import response from './waiting-bay-rm.webp';

export function WaitingBay({shadows}:{shadows:boolean}){
  const geometry=useMemo(waitingBayGeometry,[]), contact=useMemo(waitingBayContact,[]);
  const map=useCoastalPrint('timber'), finish=useBakedSurface(response,'data');
  useEffect(()=>()=>{geometry.dispose();contact.dispose();},[geometry,contact]);
  return <>
    <mesh name="terminus:waiting-bay" geometry={geometry} castShadow={shadows} receiveShadow raycast={noPick}>
      <meshStandardMaterial key={`${!!map}:${!!finish}`} vertexColors color={map?'white':'#8d836d'} map={map}
        roughness={finish?1:.75} roughnessMap={finish} metalness={finish?1:0} metalnessMap={finish}/>
    </mesh>
    {!shadows&&<mesh name="terminus:waiting-bay-contact" geometry={contact} raycast={noPick} userData={{playerCollision:false}}>
      <meshBasicMaterial color="#313d46" vertexColors transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}/>
    </mesh>}
  </>;
}
