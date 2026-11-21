import {useLayoutEffect,useMemo} from 'react';
import {RepeatWrapping} from 'three';
import {PLANET_RADIUS as R,PAD_RADIUS} from './planetLayout';
import {makeCrust} from './opalTerrain';
import {MeridianMarks,MeridianStations,SpringLights} from './MeridianStations';
import {useBakedSurface} from '../useBakedSurface';
import mineral from './fracture.webp';
import dial from './landing-rose.webp';
export {PlanetSky} from './PlanetSky';

export function GlassPlanet(){
  const print=useBakedSurface(mineral),landing=useBakedSurface(dial),stone=useMemo(makeCrust,[]);
  useLayoutEffect(()=>{if(print){print.wrapS=print.wrapT=RepeatWrapping;print.repeat.set(14,7);print.needsUpdate=true}},[print]);
  useLayoutEffect(()=>()=>stone.dispose(),[stone]);
  return <group name="planet:glass-meridian">
    <mesh name="planet:crust" geometry={stone} position-y={-R}><meshStandardMaterial key={print?.uuid} vertexColors map={print} roughness={.75} bumpMap={print} bumpScale={.028} emissive="#26363f" emissiveIntensity={.32}/></mesh>
    <MeridianMarks/><MeridianStations/><SpringLights/>
    <mesh position-y={-.17}><cylinderGeometry args={[PAD_RADIUS,PAD_RADIUS-.10,.34,80]}/><meshStandardMaterial color="#526875" roughness={.71}/></mesh>
    <mesh rotation-x={-Math.PI/2} position-y={.002}><circleGeometry args={[PAD_RADIUS-.025,80]}/><meshStandardMaterial key={landing?.uuid} map={landing} color={landing?'#ffffff':'#526875'} roughness={.70}/></mesh>
    {[1.98,2.55,2.70].map(r=><mesh key={r} rotation-x={Math.PI/2}><torusGeometry args={[r,.012,6,90]}/><meshStandardMaterial color="#e0b177"/></mesh>)}
  </group>;
}
