import {createContext,useContext,useLayoutEffect,useMemo} from 'react';
import {Color,RepeatWrapping} from 'three';
import type {StageLighting} from '../../stage/lighting';
import {useBakedSurface} from '../useBakedSurface';
import {sampleLongitude} from '../planet/sky/skySpace';
import {SHORE_SUN} from './shoreLayout';

export const HarbourLight=createContext<{lighting:StageLighting;skyEnabled:boolean}|null>(null);

// Two resolutions of the same upper hemisphere. Azimuth grows from +X towards
// +Z; at the horizon v=0. TextureLoader flips the photographed top row to v=1.
const panorama={sky:'/scenery/terminus/harbour-clear.webp',reflection:'/scenery/terminus/harbour-clear-reflection.webp'};

export function useHarbourSkyUniforms(detail:keyof typeof panorama){
  const light=useContext(HarbourLight);
  const map=useBakedSurface(panorama[detail]);
  const uniforms=useMemo(()=>({
    harbourSkyMap:{value:map},harbourMapReady:{value:map?1:0},harbourSkyEnabled:{value:1},
    harbourSunColor:{value:new Color()},harbourSunIntensity:{value:1},harbourHorizonColor:{value:new Color()},
  }),[map]);
  useLayoutEffect(()=>{
    if(map){map.wrapS=RepeatWrapping;map.needsUpdate=true;}
  },[map]);
  useLayoutEffect(()=>{
    if(!light)return;
    uniforms.harbourSunColor.value.set(light.lighting.sunColor);
    uniforms.harbourSunIntensity.value=light.lighting.sun;
    uniforms.harbourHorizonColor.value.set(light.lighting.fogColor);
    uniforms.harbourSkyEnabled.value=Number(light.skyEnabled);
  },[light,uniforms]);
  return uniforms;
}

// The water samples these same clouds and aureole, with its own surface-slope
// model for the compact solar reflection. Radiance is in linear working space.
export const harbourSkySampling=`
${sampleLongitude}
uniform sampler2D harbourSkyMap;
uniform float harbourMapReady,harbourSkyEnabled,harbourSunIntensity;
uniform vec3 harbourSunColor,harbourHorizonColor;
vec3 harbourSunDirection(){return normalize(vec3(${SHORE_SUN.map(n=>n.toFixed(2)).join(',')}));}
vec3 sampleHarbourSky(vec3 worldDir){
  vec3 d=normalize(worldDir);
  float az=atan(d.z,d.x);
  float h=clamp(d.y,0.,1.);
  vec2 skyUV=vec2(fract(.5+az*.159154943),asin(h)*.636619772);
  vec3 clear=mix(harbourHorizonColor,vec3(.073,.32,.66),smoothstep(0.,.48,h));
  vec3 plate=mix(clear,sampleLongitude(harbourSkyMap,skyUV).rgb,harbourMapReady);
  vec3 tinted=plate*mix(vec3(1.),harbourSunColor,.13);
  float a=length(d-harbourSunDirection());
  float aureole=.12*exp(-10.*a)+.28*exp(-42.*a);
  vec3 daylight=tinted+(vec3(1.)-tinted)*harbourSunColor*min(.78,aureole*harbourSunIntensity);
  return mix(vec3(.0086,.0103,.0123),daylight,harbourSkyEnabled);
}`;
