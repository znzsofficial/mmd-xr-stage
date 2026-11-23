import {useLayoutEffect,useMemo,useReducer} from 'react';
import {PLANET_RADIUS as R} from './planetLayout';
import {makeCrust} from './opalTerrain';
import {MeridianMarks,MeridianStations,SpringLights} from './MeridianStations';
import {NorthLanding} from './NorthLanding';
import {WindSystem} from './WindSystem';
import {TwinWaymarks} from './TwinWaymarks';
import {OrbitalDrift} from './OrbitalDrift';
import {StationFallout} from './StationFallout';
import {useSurfaceGrain} from './surfaceGrain';
import {opalBedrock} from './opalBedrock';
import {OpalSampler} from './OpalSampler';
import {ClearingStage} from './ClearingStage';
import {blankSurvey,lampSpectrum,surveyRelease} from './opalSurvey';
export {PlanetSky} from './PlanetSky';

export function GlassPlanet(){
  const stone=useMemo(makeCrust,[]);
  const grain=useSurfaceGrain(),crustDetail=useMemo(()=>opalBedrock(grain),[grain]);
  const [survey,release]=useReducer(surveyRelease,blankSurvey);
  useLayoutEffect(()=>()=>stone.dispose(),[stone]);
  return <group name="planet:glass-meridian">
    <mesh name="planet:crust" geometry={stone} position-y={-R}><meshStandardMaterial key={grain?.uuid} onBeforeCompile={crustDetail} vertexColors roughness={.94} emissive="#243134" emissiveIntensity={.22}/></mesh>
    <MeridianMarks/><MeridianStations lamps={lampSpectrum(survey)}/><OpalSampler state={survey} activate={release}/><SpringLights/>
    <WindSystem grain={grain}/><ClearingStage/><TwinWaymarks/><StationFallout/><OrbitalDrift/>
    <NorthLanding grain={grain}/>
  </group>;
}
