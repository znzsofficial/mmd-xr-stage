import {useLayoutEffect,useMemo} from 'react';
import {DoubleSide,RepeatWrapping} from 'three';
import {useBakedSurface} from '../useBakedSurface';
import {DESK,HALL} from './chamberLayout';
import {Masonry} from './masonry';
import {chamberShell} from './chamberShell';
import {dressChamber} from './recordRoom';
import ashlar from './ashlar.webp';
import toolstone from './toolstone.webp';
import pavement from './pavement.webp';
import oak from './oak.webp';
import arras from './arras.webp';
import register from './register.webp';
import tablets from './tablets.webp';
import windowView from './window.webp';

const surfaces={ashlar,toolstone,pavement,oak,arras,register,tablets,window:windowView};
function Printed({finish}:{finish:keyof typeof surfaces}){
  const map=useBakedSurface(surfaces[finish]);
  useLayoutEffect(()=>{if(map&&(finish==='ashlar'||finish==='toolstone'||finish==='oak')){map.wrapS=map.wrapT=RepeatWrapping;map.needsUpdate=true;}},[map,finish]);
  if(finish==='window')return <meshBasicMaterial key={map?.uuid} map={map} vertexColors toneMapped={false} side={DoubleSide}/>;
  return <meshStandardMaterial key={map?.uuid} map={map} side={DoubleSide} vertexColors roughness={finish==='oak'?.73:.92}/>;
}

export function MedievalChamber({shadows}:{shadows:boolean}){
  const parts=useMemo(()=>{const m=new Masonry();chamberShell(m);dressChamber(m);return m.build();},[]);
  useLayoutEffect(()=>()=>parts.forEach(p=>p.geometry.dispose()),[parts]);
  return <group name="scenery:medievalChamber" pointerEvents="none">
    {parts.map(({finish,geometry})=><mesh key={finish} geometry={geometry} name={`chamber:${finish}`} receiveShadow={shadows&&finish!=='light'} raycast={()=>null}>
      {finish==='light'?<meshBasicMaterial vertexColors toneMapped={false} side={DoubleSide}/>:finish==='iron'||finish==='pigment'?<meshStandardMaterial vertexColors side={DoubleSide} metalness={finish==='iron'?.33:.01} roughness={finish==='iron'?.68:.91}/>:<Printed finish={finish}/>}
    </mesh>)}
    <pointLight color="#ffbe83" intensity={2.15} distance={4.8} position={[DESK.x-.74,1.36,DESK.z-.27]}/>
    <pointLight color="#dfedea" intensity={3.1} distance={6} position={[1.73,2.21,HALL.back+.83]}/>
  </group>;
}
