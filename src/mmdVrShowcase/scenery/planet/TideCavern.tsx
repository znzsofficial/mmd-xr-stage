import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {useFrame} from '@react-three/fiber';
import {Group,LOD,RepeatWrapping,Vector3,type Texture} from 'three';
import {noPick} from '../sceneryPaint';
import {useBakedSurface} from '../useBakedSurface';
import {tideCentre,tideDatum} from './tideLayout';
import {tideCaveRock,tideForeshore,tideTerrain} from './tideStone';
import bedding from './tide-section.webp';
import strand from './tide-shore.webp';
import valveRibs from './tide-valve-normals.webp';

type TierProps={coarse:boolean;section:Texture|null;shore:Texture|null};
function Strata({coarse,section,shore,normals=null}:TierProps&{normals?:Texture|null}){
  const geo=useMemo(()=>({...tideTerrain(coarse),rock:tideCaveRock(coarse),trim:coarse?null:tideForeshore()}),[coarse]);
  useEffect(()=>()=>{geo.shore.dispose();geo.globe.dispose();geo.rock.dispose();geo.trim?.dispose();},[geo]);
  return <>
    <mesh name="tide:walking-shore" geometry={geo.shore} raycast={noPick}>
      <meshStandardMaterial vertexColors map={shore} normalMap={normals} roughness={.82} fog={false}/></mesh>
    <mesh name="tide:outer-limestone" geometry={geo.globe} raycast={noPick}>
      <meshStandardMaterial vertexColors map={section} roughness={.92} fog={false}/></mesh>
    <mesh name="tide:wave-cut-vault" geometry={geo.rock} raycast={noPick}>
      <meshStandardMaterial vertexColors map={section} roughness={.82} fog={false}/></mesh>
    {geo.trim&&<mesh name="tide:landing-piles-and-shell-beds" geometry={geo.trim} raycast={noPick}>
      <meshStandardMaterial vertexColors roughness={.78} fog={false}/></mesh>}
  </>;
}
function NearStrata(props:Omit<TierProps,'coarse'>){
  const normals=useBakedSurface(valveRibs,'data');return <Strata {...props} coarse={false} normals={normals}/>;
}

/** One hollow, west-facing formation. The polar chart is the topological
 * continuation of the lunar shell, not a stage hiding a sphere underneath. */
export function TideCavern(){
  const lod=useMemo(()=>new LOD(),[]),near=useRef<Group>(null),far=useRef<Group>(null);
  const [detailed,setDetailed]=useState(false),requested=useRef(false),eye=useMemo(()=>new Vector3(),[]);
  const section=useBakedSurface(bedding),shore=useBakedSurface(strand);
  useFrame(({camera,gl})=>{if(requested.current)return;
    (gl.xr.isPresenting?gl.xr.getCamera():camera).getWorldPosition(eye);
    if(eye.distanceToSquared(lod.position)<26*26){requested.current=true;setDetailed(true);}
  });
  useLayoutEffect(()=>{if(section){section.wrapS=section.wrapT=RepeatWrapping;section.needsUpdate=true;}},[section]);
  useLayoutEffect(()=>{const a=near.current,b=far.current;if(!b)return;
    if(a){lod.addLevel(a,0);lod.addLevel(b,24,.12);b.visible=false;}else{lod.addLevel(b,0);b.visible=true;}
    return ()=>{lod.levels.length=0;};},[lod,detailed]);
  return <primitive object={lod} name="planet:moon-tide" position={[tideCentre.x,tideDatum,tideCentre.z]} userData={{playerCollision:false}}>
    <group ref={far}><Strata coarse section={section} shore={shore}/></group>
    {detailed&&<group ref={near}><NearStrata section={section} shore={shore}/></group>}
  </primitive>;
}
