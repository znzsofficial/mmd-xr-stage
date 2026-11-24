import { useEffect, useMemo, type RefObject } from 'react';
import * as THREE from 'three';
import { CourtSky } from '../scenery/AstralCourt';
import {PlanetSky} from '../scenery/planet/GlassPlanet';
import { DaySky } from '../scenery/DaylightSets';
import { StudioPlinth } from '../scenery/StudioPlinth';
import { showSceneryGrid, type SceneryId } from '../scenery/catalog';
import { RiverSky } from '../scenery/qinhuai/Songhouse';
import { RoomSet, roomSets } from '../scenery/roomSets';
import { StreetScenery } from '../scenery/routes/StreetScenery';
import { hasStageLamps } from '../settings/stageLamps';
import type { MmdVrRenderProfile } from '../settings/mmdVrQuality';
import type { MmdVrPrefs } from '../settings/preferences';
import type { StageLighting } from './lighting';

function GradientSky({zenith, horizon, bottom}: {zenith: string; horizon: string; bottom: string}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 4; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 64);
      gradient.addColorStop(0, zenith); gradient.addColorStop(.55, horizon); gradient.addColorStop(1, bottom);
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 4, 64);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true;
    return map;
  }, [zenith, horizon, bottom]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh scale={[-1,1,1]} renderOrder={-10}>
    <sphereGeometry args={[28,24,16]}/>
    <meshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} fog={false}/>
  </mesh>;
}

function Sky({scenery, lighting, warm}: {scenery: SceneryId; lighting: StageLighting; warm: boolean}) {
  switch (roomSets[scenery].sky) {
    case 'stars': return <PlanetSky/>;
    case 'river': return <RiverSky/>;
    case 'court': return <CourtSky/>;
    case 'day': return <DaySky sun={lighting.sunPos} warm={warm || !!roomSets[scenery].warm}/>;
    default: return <GradientSky zenith={lighting.skyZenith} horizon={lighting.skyHorizon} bottom={lighting.fogColor}/>;
  }
}

function LightPool({color, opacity}: {color: string; opacity: number}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      gradient.addColorStop(0, '#ffffff'); gradient.addColorStop(.22, '#ffffff'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    }
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <mesh rotation={[-Math.PI/2,0,0]} position={[0,.006,-.35]}>
    <planeGeometry args={[5.4,5.4]}/>
    <meshBasicMaterial map={texture} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending}/>
  </mesh>;
}

type Props = {
  scenery: SceneryId; lighting: StageLighting; prefs: MmdVrPrefs; profile: MmdVrRenderProfile;
  sunRef: RefObject<THREE.DirectionalLight | null>;
};

/** Render-only scenery shared by screen and XR. BackpackPlacement owns placement picks. */
export function StageEnvironment({scenery, lighting, prefs, profile, sunRef}: Props) {
  const { viewDistance, lightPreset } = prefs;
  const extent = profile.quality === 'high' ? 6 : profile.quality === 'balanced' ? 5 : 4;
  const far = profile.quality === 'high' ? 24 : profile.quality === 'balanced' ? 20 : 16;
  const shadowSize = profile.shadows ? profile.shadowMapSize : 256;
  const rim = lighting.rimIntensity > 0 ? lighting.rimIntensity : .28;
  const lamps = hasStageLamps(scenery);
  return <>
    <color attach="background" args={['#171a1d']}/>
    {prefs.stageFogEnabled && scenery!=='glassPlanet' && <fog attach="fog" args={[lighting.fogColor, Math.min(10, viewDistance*.45), viewDistance]}/>}
    {prefs.stageSkyEnabled && <Sky scenery={scenery} lighting={lighting} warm={lightPreset==='warm'}/>}
    <ambientLight color={lighting.ambientColor} intensity={lighting.ambient}/>
    <directionalLight ref={sunRef} position={lighting.sunPos} color={lighting.sunColor} intensity={lighting.sun}
      castShadow={profile.shadows} shadow-mapSize-width={shadowSize} shadow-mapSize-height={shadowSize}
      shadow-camera-near={.5} shadow-camera-far={far} shadow-camera-left={-extent} shadow-camera-right={extent}
      shadow-camera-top={extent} shadow-camera-bottom={-extent}/>
    <hemisphereLight args={[lighting.hemiSky, lighting.hemiGround, lighting.hemi]}/>
    {lamps && prefs.stageRimLightEnabled && <pointLight color={lighting.rimColor} intensity={rim} distance={8} decay={2} position={lighting.rimPosition}/>}
    <group name="player:room-solids">
      {scenery==='floor' && <StudioPlinth segments={profile.floorSegments} shadows={profile.shadows} color={lighting.floorColor}/>}
      <RoomSet id={scenery} shadows={profile.shadows} concert={lightPreset==='contrast'}/>
      <StreetScenery room={scenery}/>
    </group>
    {lamps && prefs.stageLightPoolEnabled && <LightPool color={lighting.poolColor} opacity={Math.min(.14, rim*.08)}/>}
    {showSceneryGrid(scenery, profile.showGrid, prefs.gridPref==='on') && <gridHelper args={[12,12,'#d8dce0','#a5aaae']} position={[0,.01,0]}/>}
  </>;
}
