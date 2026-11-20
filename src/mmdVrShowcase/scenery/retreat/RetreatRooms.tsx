import {useLayoutEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {DoubleSide,Matrix4,RepeatWrapping} from 'three';
import type {BufferGeometry,InstancedMesh} from 'three';
import {useBakedSurface} from '../useBakedSurface';
import {buildSuite} from './suite';
import {buildSpa} from './spa';
import type {Finish} from './joinery';
import wood from './quarter-sawn.webp';
import stone from './mineral.webp';
import silk from './silk.webp';
import brocade from './brocade.webp';
import city from './blue-hour.webp';
import garden from './mist-garden.webp';
import water from './spring-water.webp';
import occlusion from './contact.webp';
import {SPA,SUITE,type Slab} from './retreatLayout';

const surfaces={wood,stone,cloth:silk,brocade,city,garden,water};
type Printed=keyof typeof surfaces;
function SpringWater(){
  const map=useBakedSurface(water);
  // Refracted light drifts a few millimetres across the bounded basin; the
  // silhouette, coping and support remain fixed. No render target or extra pass.
  useFrame(({clock})=>{if(map){const t=clock.elapsedTime;map.offset.set(.0038*Math.sin(.53*t),.0055*Math.sin(.69*t+.6));}});
  return <meshStandardMaterial key={map?.uuid} vertexColors map={map} roughness={.35} metalness={.06}/>;
}
function PrintedSurface({id}:{id:Exclude<Printed,'water'>}){
  const map=useBakedSurface(surfaces[id]);
  const repeat=id==='wood'||id==='stone'||id==='cloth'||id==='brocade';
  useLayoutEffect(()=>{if(map&&repeat){map.wrapS=map.wrapT=RepeatWrapping;map.needsUpdate=true;}},[map,repeat]);
  // A Three material compiled with map=null has no USE_MAP in its program.
  // Replace the material when the print arrives, including on a restored room.
  if(id==='city'||id==='garden')return <meshBasicMaterial key={map?.uuid} vertexColors map={map} toneMapped={false}/>;
  return <meshStandardMaterial key={map?.uuid} vertexColors map={map} side={DoubleSide} roughness={id==='stone'?.56:id==='brocade'?.72:.86} metalness={.015}/>;
}
function Contacts({items,tint}:{items:Slab[];tint:string}){
  const map=useBakedSurface(occlusion);
  const ref=useRef<InstancedMesh>(null);
  useLayoutEffect(()=>{
    const mesh=ref.current;if(!mesh)return;
    const m=new Matrix4();
    items.forEach((r,i)=>{
      // Unit XY quad laid flat at exactly the original stamp height, UVs unchanged.
      m.set(r.w+.46,0,0,r.x, 0,0,1,.0135, 0,-r.d-.46,0,r.z, 0,0,0,1);
      mesh.setMatrixAt(i,m);
    });
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  },[items,map]);
  if(!map)return null;
  return <instancedMesh ref={ref} args={[undefined,undefined,items.length]} pointerEvents="none" raycast={()=>null}>
    <planeGeometry/><meshBasicMaterial map={map} transparent depthWrite={false} color={tint} opacity={.46}/></instancedMesh>;
}
function Pieces({parts,shadows}:{parts:{geometry:BufferGeometry;finish:Finish}[];shadows:boolean}){
  return parts.map(({finish,geometry})=><mesh key={finish} name={`retreat:${finish}`} castShadow={false} receiveShadow={shadows&&finish!=='glow'} raycast={()=>null}>
    <primitive object={geometry} attach="geometry"/>
    {finish==='water'?<SpringWater/>:finish==='glow'?<meshBasicMaterial vertexColors toneMapped={false}/>:finish==='stream'?<meshStandardMaterial side={DoubleSide} vertexColors transparent depthWrite={false} opacity={.52} roughness={.19}/>:finish==='matte'||finish==='metal'?<meshStandardMaterial side={DoubleSide} vertexColors roughness={finish==='metal'?.36:.86} metalness={finish==='metal'?.42:.015}/>:<PrintedSurface id={finish}/>}
  </mesh>);
}
function Interior({build,name,shadows}:{build:typeof buildSuite;name:string;shadows:boolean}){
  const parts=useMemo(build,[build]);
  useLayoutEffect(()=>()=>parts.forEach(p=>p.geometry.dispose()),[parts]);
  return <group name={name} pointerEvents="none"><Pieces parts={parts} shadows={shadows}/></group>;
}
const suiteContact=[SUITE.bed,...SUITE.tables,SUITE.sofa,SUITE.tea,SUITE.cabinet],spaContact=[SPA.bench,SPA.locker,SPA.spout,SPA.towels];
export function LanternSuite({shadows}:{shadows:boolean}){return <group><Interior build={buildSuite} name="retreat:lanternSuite" shadows={shadows}/><Contacts items={suiteContact} tint="#423036"/>
  {SUITE.tables.map(t=><pointLight key={t.x} color="#ffbd82" intensity={1.8} distance={4} decay={2} position={[t.x,1.30,t.z+.19]}/>)}</group>;}
export function MoonSpa({shadows}:{shadows:boolean}){return <group><Interior build={buildSpa} name="retreat:moonSpa" shadows={shadows}/>
  <Contacts items={spaContact} tint="#3e5149"/><pointLight color="#fff1cd" intensity={2.4} distance={5.5} decay={2} position={[.14,2.64,-5.93]}/></group>;}
