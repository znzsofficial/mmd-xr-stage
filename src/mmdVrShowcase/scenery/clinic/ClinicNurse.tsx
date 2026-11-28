import {useEffect,useMemo} from 'react';
import {DataTexture,SRGBColorSpace} from 'three';
import {DaySurface} from '../daylightMaterials';
import {nurseFinish} from './wardDaylight';
import {useMmdVrStore} from '../../mmdVrStore';
import {useBakedSurface} from '../useBakedSurface';
import {FIXTURES} from './clinicLayout';
import {clinicNurseGeometry} from './nurseFigure';
import paintUrl from './clinic-nurse.webp';

type Props={shadows:boolean};
function NurseMesh({shadows}:Props){
  const geometry=useMemo(clinicNurseGeometry,[]),paint=useBakedSurface(paintUrl);
  // Keep the existing figure visible before the portrait finishes decoding.
  const primer=useMemo(()=>{
    const rgba=[0xe0b092,0xe0b092,0xffffff,0xffffff,0xe0b092,0xe0b092,0x41302a,0xffffff];
    const map=new DataTexture(new Uint8Array(rgba.flatMap(c=>[c>>16,(c>>8)&255,c&255,255])),4,2);
    map.colorSpace=SRGBColorSpace;map.needsUpdate=true;return map;
  },[]);
  useEffect(()=>()=>{geometry.dispose();primer.dispose()},[geometry,primer]);
  useEffect(()=>{if(paint)primer.dispose()},[paint,primer]);
  return <mesh name="scenery:clinic-nurse" position={[FIXTURES.deskSeat.x,0,FIXTURES.deskSeat.z]} raycast={()=>null}
    pointerEvents="none" castShadow={shadows} receiveShadow={shadows}>
    <primitive object={geometry} attach="geometry"/><DaySurface map={paint??primer} vertexColors onBeforeCompile={nurseFinish}/>
  </mesh>;
}

export function ClinicNurse(props:Props){
  return useMmdVrStore(s=>s.prefs.showSceneryPeople)?<NurseMesh {...props}/>:null;
}
