import {useLayoutEffect,useMemo} from 'react';
import {DoubleSide,RepeatWrapping} from 'three';
import {useBakedSurface} from '../useBakedSurface';
import type {Finish} from '../retreat/joinery';
import timber from '../retreat/quarter-sawn.webp';
import print from './moon-etch.webp';
import velour from './velour-n.webp';
import satin from './satin-n.webp';
import leather from './leather-n.webp';
import contact from '../retreat/contact.webp';
import {buildVelvetStudio} from './studioShell';
import {StudioStrip} from './StudioStrip';
import {velvetPlan} from './velvetLayout';

const finishes={cloth:{name:'velvet',url:velour,rough:.89,sheen:1,sheenColor:'#7e6778',sheenRoughness:.78,aniso:0,coat:0},
  brocade:{name:'satin',url:satin,rough:.34,sheen:.72,sheenColor:'#dfb4ae',sheenRoughness:.38,aniso:.68,coat:0},
  stone:{name:'leather',url:leather,rough:.63,sheen:0,sheenColor:'#ffffff',sheenRoughness:.65,aniso:0,coat:.18}} as const;
function Upholstery({kind}:{kind:keyof typeof finishes}){
  const f=finishes[kind],normal=useBakedSurface(f.url,'data');
  useLayoutEffect(()=>{if(normal){normal.wrapS=normal.wrapT=RepeatWrapping;normal.repeat.setScalar(kind==='stone'?3:2.8);normal.needsUpdate=true;}},[normal,kind]);
  return <meshPhysicalMaterial key={normal?.uuid} name={`velvet:${f.name}`} vertexColors side={DoubleSide} normalMap={normal} normalScale={[.63,.63]}
    sheen={f.sheen} sheenColor={f.sheenColor} sheenRoughness={f.sheenRoughness} roughness={f.rough} anisotropy={f.aniso} anisotropyRotation={.54} clearcoat={f.coat} clearcoatRoughness={.53}/>;
}
function Printed({wood}:{wood?:boolean}){
  const map=useBakedSurface(wood?timber:print);
  useLayoutEffect(()=>{if(wood&&map){map.wrapS=map.wrapT=RepeatWrapping;map.needsUpdate=true;}},[map,wood]);
  return <meshStandardMaterial key={map?.uuid} vertexColors side={DoubleSide} map={map} roughness={wood?.66:.90}/>;
}
function Surface({finish}:{finish:Finish}){
  if(finish==='cloth'||finish==='brocade'||finish==='stone')return <Upholstery kind={finish}/>;
  if(finish==='wood'||finish==='city')return <Printed wood={finish==='wood'}/>;
  if(finish==='glow')return <meshBasicMaterial vertexColors toneMapped={false}/>;
  return <meshStandardMaterial vertexColors roughness={finish==='metal'?.38:.84} metalness={finish==='metal'?.45:0} side={DoubleSide}/>;
}
function FloorContacts(){
  const map=useBakedSurface(contact);
  if(!map)return null;
  return <group pointerEvents="none">{[velvetPlan.sofa,velvetPlan.wardrobe,velvetPlan.bench,velvetPlan.console].map(b=><mesh key={b.x} position={[b.x,.005,b.z]} rotation-x={-Math.PI/2} raycast={()=>null}>
    <planeGeometry args={[b.w+.41,b.d+.34]}/><meshBasicMaterial map={map} color="#37282c" transparent depthWrite={false} opacity={.52}/>
  </mesh>)}</group>;
}
export function VelvetStudio({shadows}:{shadows:boolean}){
  const pieces=useMemo(buildVelvetStudio,[]);
  useLayoutEffect(()=>()=>pieces.forEach(p=>p.geometry.dispose()),[pieces]);
  return <group name="velvet:studio"><group pointerEvents="none">{pieces.map(({geometry,finish})=><mesh key={finish} name={`velvet:set:${finish}`} receiveShadow={shadows} castShadow={shadows&&(finish==='cloth'||finish==='brocade'||finish==='stone')} raycast={()=>null}>
    <primitive object={geometry} attach="geometry"/><Surface finish={finish}/></mesh>)}</group>
    <pointLight position={[4.46,2.12,-2.59]} intensity={4.5} distance={5} decay={2} color="#ffdcbd"/>
    <pointLight position={[-.99,2.16,-2.64]} intensity={2.5} distance={4.1} decay={2} color="#ffdcba"/>
    <FloorContacts/>
    <StudioStrip/>
  </group>;
}
