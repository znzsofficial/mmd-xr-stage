import {useLayoutEffect,useMemo,useReducer} from 'react';
import {PLANET_RADIUS as R,PAD_RADIUS} from './planetLayout';
import {makeCrust} from './opalTerrain';
import {MeridianMarks,MeridianStations,SpringLights} from './MeridianStations';
import {useBakedSurface} from '../useBakedSurface';
import dial from './landing-rose.webp';
import {WindSystem} from './WindSystem';
import {TwinWaymarks} from './TwinWaymarks';
import {OrbitalDrift} from './OrbitalDrift';
import {StationFallout} from './StationFallout';
import {opalGrain,useSurfaceGrain} from './surfaceGrain';
import {opalBedrock} from './opalBedrock';
import {OpalSampler} from './OpalSampler';
import {blankSurvey,lampSpectrum,surveyRelease} from './opalSurvey';
export {PlanetSky} from './PlanetSky';

export function GlassPlanet(){
  const landing=useBakedSurface(dial),stone=useMemo(makeCrust,[]);
  const grain=useSurfaceGrain(),crustDetail=useMemo(()=>opalBedrock(grain),[grain]),deckDetail=useMemo(()=>opalGrain(grain,.42),[grain]);
  const [survey,release]=useReducer(surveyRelease,blankSurvey);
  useLayoutEffect(()=>()=>stone.dispose(),[stone]);
  return <group name="planet:glass-meridian">
    <mesh name="planet:crust" geometry={stone} position-y={-R}><meshStandardMaterial key={grain?.uuid} onBeforeCompile={crustDetail} vertexColors roughness={.94} emissive="#243134" emissiveIntensity={.22}/></mesh>
    <MeridianMarks/><MeridianStations lamps={lampSpectrum(survey)}/><OpalSampler state={survey} activate={release}/><SpringLights/>
    <WindSystem grain={grain}/><TwinWaymarks/><StationFallout/><OrbitalDrift/>
    <mesh position-y={-.17}><cylinderGeometry args={[PAD_RADIUS,PAD_RADIUS-.10,.34,80]}/><meshStandardMaterial color="#526875" roughness={.71}/></mesh>
    <mesh rotation-x={-Math.PI/2} position-y={.002}><circleGeometry args={[PAD_RADIUS-.025,80]}/><meshStandardMaterial key={`${landing?.uuid}:${grain?.uuid}`} onBeforeCompile={deckDetail} map={landing} color={landing?'#ffffff':'#526875'} roughness={.70}/></mesh>
    {[1.98,2.55,2.70].map(r=><mesh key={r} rotation-x={Math.PI/2}><torusGeometry args={[r,.012,6,90]}/><meshStandardMaterial color="#e0b177"/></mesh>)}
  </group>;
}
