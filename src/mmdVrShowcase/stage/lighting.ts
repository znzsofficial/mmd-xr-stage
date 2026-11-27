import type { MmdVrLightPreset } from '../settings/preferences';

export type RoomLightingOverrides = {
  sun?: [number,number,number]; ambient?: number; hemi?: number;
  hemiSky?: string; hemiGround?: string; fog?: string; warmFog?: string;
  // The ordinary stage preset follows this location's daylight. Deliberately
  // selected looks (warm, rim, soft, etc.) keep their own key and ambient.
  stageLight?: Pick<StageLighting, 'sun' | 'sunColor' | 'ambientColor'>;
};

export type StageLighting = {
  ambient: number; ambientColor: string;
  sun: number; sunColor: string; sunPos: [number,number,number];
  hemi: number; hemiSky: string; hemiGround: string;
  skyZenith: string; skyHorizon: string; fogColor: string; floorColor: string;
  rimColor: string; rimIntensity: number; rimPosition: [number,number,number]; poolColor: string;
};

const presets: Record<MmdVrLightPreset, StageLighting> = {
  stage: {
    ambient: .52, ambientColor: '#f0eeea', sun: .91, sunColor: '#fff9ef', sunPos: [-3,4.2,4.8],
    hemi: .42, hemiSky: '#b8c8e0', hemiGround: '#1a2230',
    skyZenith: '#1a2840', skyHorizon: '#0e1520', fogColor: '#0c1018', floorColor: '#1a2230',
    rimColor: '#6688bb', rimIntensity: 0, rimPosition: [0,3.5,-3.5], poolColor: '#6688bb',
  },
  soft: {
    ambient: .75, ambientColor: '#f4efff', sun: .55, sunColor: '#fff5f0', sunPos: [1.5,5.5,3.5],
    hemi: .55, hemiSky: '#cedcf2', hemiGround: '#26313f',
    skyZenith: '#3a4060', skyHorizon: '#2a2c44', fogColor: '#282a46', floorColor: '#34344c',
    rimColor: '#a891cf', rimIntensity: .35, rimPosition: [0,3.2,-3], poolColor: '#a891cf',
  },
  contrast: {
    ambient: .41, ambientColor: '#e4e9f2', sun: 1.03, sunColor: '#fff0e2', sunPos: [3.6,3.8,4.2],
    hemi: .36, hemiSky: '#9eb4d5', hemiGround: '#090d14',
    skyZenith: '#0a1018', skyHorizon: '#05080c', fogColor: '#0a0e15', floorColor: '#141a26',
    rimColor: '#5879bb', rimIntensity: .55, rimPosition: [0,4.5,-4], poolColor: '#5879bb',
  },
  daylight: {
    ambient: .62, ambientColor: '#e8f2ff', sun: 1.18, sunColor: '#fffdf4', sunPos: [-3.5,7.5,4.5],
    hemi: .52, hemiSky: '#b9dcf5', hemiGround: '#40515a',
    skyZenith: '#4a86b8', skyHorizon: '#b7ccd8', fogColor: '#a3bccb', floorColor: '#5a6a76',
    rimColor: '#b9e7ff', rimIntensity: .2, rimPosition: [-2.5,4,-3], poolColor: '#b9e7ff',
  },
  warm: {
    ambient: .42, ambientColor: '#ffd8c2', sun: 1.22, sunColor: '#ffb782', sunPos: [4.8,4.2,3.6],
    hemi: .3, hemiSky: '#a08aa0', hemiGround: '#3a2f38',
    skyZenith: '#5a4566', skyHorizon: '#9a6a70', fogColor: '#8a5f66', floorColor: '#4a3a42',
    rimColor: '#ff8dba', rimIntensity: .45, rimPosition: [-1.5,3.5,-3.2], poolColor: '#ff8dba',
  },
  rim: {
    ambient: .3, ambientColor: '#d9e5ff', sun: 1.35, sunColor: '#8fe9ff', sunPos: [-1.8,5.2,-4.5],
    hemi: .28, hemiSky: '#86bcd1', hemiGround: '#151a26',
    skyZenith: '#1a3246', skyHorizon: '#24384c', fogColor: '#1e3142', floorColor: '#26303f',
    rimColor: '#63eaff', rimIntensity: 1.1, rimPosition: [0,3.8,-4.5], poolColor: '#63eaff',
  },
};

/** The same resolved light feeds both the visible room and the MMD evaluator. */
export function resolveStageLighting(preset: MmdVrLightPreset, room: RoomLightingOverrides): StageLighting {
  const base = presets[preset];
  return {
    ...base, ...(preset === 'stage' ? room.stageLight : undefined), sunPos: room.sun ?? base.sunPos,
    ambient: base.ambient + (room.ambient ?? 0), hemi: base.hemi + (room.hemi ?? 0),
    hemiSky: room.hemiSky ?? base.hemiSky, hemiGround: room.hemiGround ?? base.hemiGround,
    fogColor: (preset === 'warm' ? room.warmFog : undefined) ?? room.fog ?? base.fogColor,
  };
}
