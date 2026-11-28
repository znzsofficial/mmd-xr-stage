import type { ComponentType } from 'react';
import { LiveHouse } from './LiveHouse';
import { AstralCourt } from './AstralCourt';
import { DawnChapel } from './DawnChapel';
import { Classroom } from './Classroom';
import { Meadow } from './Meadow';
import { PoolTerrace } from './PoolTerrace';
import {CHAPEL_SUN} from './ChapelLayout';
import {MEADOW_SUN} from './meadowLandmarks';
import { ClinicWard } from './clinic/ClinicWard';
import { Songhouse } from './qinhuai/Songhouse';
import { WeddingCourt } from './wedding/WeddingCourt';
import {LanternSuite,MoonSpa} from './retreat/RetreatRooms';
import {GlassPlanet} from './planet/GlassPlanet';
import {VelvetStudio} from './velvet/VelvetStudio';
import {MedievalChamber} from './chamber/MedievalChamber';
import {ArcadeHall} from './arcade/ArcadeHall';
import {SeasideTerminus} from './terminus/SeasideTerminus';
import {SHORE_SUN,shoreDaylight} from './shoreDaylight';
import type {SceneryId} from './catalog';
import type {RoomLightingOverrides} from '../stage/lighting';

// Deliberately separate from the prep-page catalog. The registry holds
// component types, never mounted meshes, textures or inactive room worlds.
type RoomSetDefinition=RoomLightingOverrides & {view:ComponentType<{shadows:boolean;concert:boolean}>;
  sky?:'day'|'court'|'river'|'stars'|'harbour';warm?:boolean};
const day={sky:'day',hemi:.32,hemiSky:'#d4e5ee',hemiGround:'#a79d8d',fog:'#c5dfe6',warmFog:'#e7c8a7'} as const;
const [shoreX,shoreY,shoreZ]=SHORE_SUN;
export const roomSets:Record<SceneryId,RoomSetDefinition>={
  // Move the directional shadow camera up its own ray so the outer quay is in front of it.
  seasideTerminus:{...shoreDaylight,view:SeasideTerminus,sky:'harbour',sun:[shoreX*4,shoreY*4,shoreZ*4],hemiGround:'#ccd4ca',hemi:.86},
  arcadeHall:{...shoreDaylight,sky:'harbour',view:ArcadeHall,ambient:-.07,hemi:.34,hemiGround:'#a49ca0',
    stageLight:{...shoreDaylight.stageLight,sun:.90}},
  glassPlanet:{view:GlassPlanet,sky:'stars',sun:[-5,3.2,3.8],hemiSky:'#e2d8fb',hemiGround:'#b4a0bf',hemi:.54,fog:'#15192f'},
  floor:{view:()=>null}, // StudioPlinth belongs to the shared StageFloor.
  liveHouse:{view:LiveHouse},
  classroom:{...shoreDaylight,sky:'harbour',view:Classroom,ambient:-.04,hemi:.46,hemiGround:'#bba990',
    stageLight:{...shoreDaylight.stageLight,sun:1.19}},
  lawn:{...day,view:Meadow,sun:MEADOW_SUN,hemiGround:'#72845a'},
  pool:{...shoreDaylight,sky:'harbour',view:PoolTerrace,hemi:.67,hemiGround:'#b3c9bd'},
  astralCourt:{view:AstralCourt,sky:'court',hemiSky:'#dadcf5',hemiGround:'#797883',hemi:.42,fog:'#555572'},
  chapel:{view:DawnChapel,sky:'day',sun:CHAPEL_SUN,warm:true,hemiSky:'#f5ede0',hemiGround:'#bcada1',hemi:.56,fog:'#d9d1c7'},
  clinic:{...shoreDaylight,sky:'harbour',view:ClinicWard,hemiGround:'#bdc7c1',hemi:.51,
    stageLight:{...shoreDaylight.stageLight,sun:1.01}},
  qinhuai:{view:Songhouse,sky:'river',sun:[-3,5.8,5.2],ambient:.11,hemiSky:'#f7d9b0',hemiGround:'#a68d7c',hemi:.48,fog:'#a59b98'},
  weddingCourt:{view:WeddingCourt,sky:'day',sun:[-3.4,6.1,5.8],ambient:.13,hemi:.48,hemiSky:'#faebd8',hemiGround:'#bdab98',fog:'#e6d9c6'},
  lanternSuite:{view:LanternSuite,sun:[3.8,3.02,-2.8],ambient:.20,hemi:.50,hemiSky:'#ffe0c8',hemiGround:'#ac8388',fog:'#513d49'},
  moonSpa:{view:MoonSpa,sun:[-2.8,3.18,-4.92],ambient:.23,hemi:.50,hemiSky:'#e5efdf',hemiGround:'#8caaa1',fog:'#89978b'},
  velvetStudio:{view:VelvetStudio,hemiSky:'#e4ced3',hemiGround:'#6f6068',fog:'#28212b'},
  medievalChamber:{view:MedievalChamber,sun:[-3.8,4.6,-2.4],hemiSky:'#d6deeb',hemiGround:'#8f7967',hemi:.24,fog:'#484047'},
};
export function RoomSet({id,shadows,concert}:{id:SceneryId;shadows:boolean;concert:boolean}){
  const Set=roomSets[id].view;return <Set shadows={shadows} concert={concert}/>;
}
